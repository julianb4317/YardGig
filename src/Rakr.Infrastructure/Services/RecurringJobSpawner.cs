using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;

namespace Rakr.Infrastructure.Services;

/// <summary>
/// Background service that runs every hour to:
/// 1. Spawn job instances for active recurring series whose next occurrence is today or past.
/// 2. Charge the customer's card for each spawned instance (escrow).
/// 3. Check for expiring cards and transition series to PaymentRequired.
/// </summary>
public class RecurringJobSpawner(IServiceScopeFactory scopeFactory, ILogger<RecurringJobSpawner> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait 30s after startup before first run
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessRecurringSeries(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error in RecurringJobSpawner");
            }

            // Run every hour
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task ProcessRecurringSeries(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var paymentService = scope.ServiceProvider.GetRequiredService<IPaymentService>();
        var commissionService = scope.ServiceProvider.GetRequiredService<ICommissionService>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now = DateTime.UtcNow;

        // 1. Find active series with next occurrence <= now
        var dueSeries = await db.RecurringJobSeries
            .Include(s => s.TemplateJob)
            .Include(s => s.CustomerProfile)
            .Where(s => s.Status == RecurringSeriesStatus.Active
                && s.NextOccurrence.HasValue
                && s.NextOccurrence.Value <= now)
            .ToListAsync(ct);

        foreach (var series in dueSeries)
        {
            try
            {
                await SpawnInstance(db, paymentService, commissionService, notifications, series, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to spawn instance for series {SeriesId}", series.Id);
            }
        }

        // 2. Check for expiring cards (within 7 days of next occurrence)
        var upcomingSeries = await db.RecurringJobSeries
            .Include(s => s.CustomerProfile)
            .Where(s => s.Status == RecurringSeriesStatus.Active
                && s.NextOccurrence.HasValue
                && s.NextOccurrence.Value <= now.AddDays(7))
            .ToListAsync(ct);

        foreach (var series in upcomingSeries)
        {
            var card = await db.CustomerPaymentMethods
                .FirstOrDefaultAsync(pm => pm.CustomerProfileId == series.CustomerProfileId && pm.IsDefault, ct);

            if (card is null || (card.ExpMonth > 0 && IsCardExpired(card.ExpMonth, card.ExpYear)))
            {
                series.Status = RecurringSeriesStatus.PaymentRequired;
                await notifications.SendInAppNotificationAsync(
                    series.CustomerProfile.UserId,
                    "payment_required",
                    "Payment method needs updating",
                    "Your card on file has expired or is missing. Please update it to continue your recurring job.",
                    new { seriesId = series.Id }, ct);
            }
        }

        await db.SaveChangesAsync(ct);

        // 3. Auto-complete hourly jobs that exceeded max hours + 2h buffer
        var overdueHourlyJobs = await db.JobRequests
            .Include(j => j.Assignment)
            .Include(j => j.CustomerProfile)
            .Where(j => j.PricingType == "hourly"
                && j.Status == JobStatus.InProgress
                && j.Assignment != null
                && j.Assignment.StartedAt != null
                && j.MaxHours.HasValue)
            .ToListAsync(ct);

        foreach (var job in overdueHourlyJobs)
        {
            var elapsed = (DateTime.UtcNow - job.Assignment!.StartedAt!.Value).TotalHours;
            var maxWithBuffer = (double)job.MaxHours!.Value + 2.0;
            if (elapsed > maxWithBuffer)
            {
                job.Status = JobStatus.Completed;
                job.Assignment.CompletedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;

                // Notify customer
                await notifications.SendInAppNotificationAsync(
                    job.CustomerProfile.UserId, "hourly_auto_completed",
                    "Job auto-completed",
                    $"Your hourly job \"{job.Title}\" was automatically marked complete after exceeding the maximum time. Please review and verify.",
                    new { jobId = job.Id }, ct);
            }
        }

        // 4. Auto-release payment for jobs completed more than 48 hours ago without customer verification
        // SKIP jobs that have an open/investigating dispute — payment held until dispute resolves
        var disputedJobIds = await db.Disputes
            .Where(d => d.Status == DisputeStatus.Open || d.Status == DisputeStatus.Investigating)
            .Select(d => d.JobRequestId)
            .ToListAsync(ct);

        var overdueCompletedJobs = await db.JobRequests
            .Include(j => j.Assignment).ThenInclude(a => a!.VendorProfile)
            .Include(j => j.CustomerProfile)
            .Where(j => j.Status == JobStatus.Completed
                && j.Assignment != null
                && j.Assignment.CompletedAt != null
                && j.Assignment.CompletedAt.Value < now.AddHours(-48)
                && !disputedJobIds.Contains(j.Id))
            .ToListAsync(ct);

        foreach (var job in overdueCompletedJobs)
        {
            try
            {
                // Find the escrow
                var escrow = await db.EscrowTransactions
                    .FirstOrDefaultAsync(e => e.JobRequestId == job.Id
                        && (e.Status == Rakr.Domain.Entities.EscrowStatus.Authorized
                            || e.Status == Rakr.Domain.Entities.EscrowStatus.Held), ct);

                if (escrow == null || string.IsNullOrEmpty(escrow.StripePaymentIntentId)) continue;

                // For hourly jobs, calculate actual amount based on elapsed time
                int actualVendorCents = escrow.VendorAmountCents;
                int captureAmountCents = escrow.AmountCents;

                if (job.PricingType == "hourly" && job.HourlyRateCents.HasValue && job.Assignment!.StartedAt.HasValue)
                {
                    var elapsedHours = (decimal)(job.Assignment.CompletedAt!.Value - job.Assignment.StartedAt.Value).TotalHours;
                    var cappedHours = job.MaxHours.HasValue ? Math.Min(elapsedHours, job.MaxHours.Value) : elapsedHours;
                    actualVendorCents = (int)Math.Ceiling((double)cappedHours * (double)job.HourlyRateCents.Value);

                    // Recalculate fees on actual amount
                    var fees = await commissionService.CalculateFeesAsync(actualVendorCents, Guid.Empty, job.Categories.ToArray(), ct);
                    captureAmountCents = fees.TotalChargeCents;
                    actualVendorCents = fees.BudgetCents;
                }

                // Capture — partial for hourly, full for fixed
                if (escrow.Status == Rakr.Domain.Entities.EscrowStatus.Authorized)
                {
                    var captureResult = await paymentService.CapturePaymentAsync(
                        escrow.StripePaymentIntentId,
                        job.PricingType == "hourly" ? captureAmountCents : null,
                        ct);
                    if (!captureResult.Succeeded) continue;
                }

                // Release escrow
                escrow.Status = Rakr.Domain.Entities.EscrowStatus.Released;
                escrow.ReleasedAt = DateTime.UtcNow;
                escrow.CapturedAt ??= DateTime.UtcNow;
                escrow.VendorAmountCents = actualVendorCents;

                // Credit vendor balance
                var vendorProfile = job.Assignment!.VendorProfile;
                var vendorBalance = await db.VendorBalances
                    .FirstOrDefaultAsync(vb => vb.VendorProfileId == vendorProfile.Id, ct);
                if (vendorBalance is null)
                {
                    vendorBalance = new VendorBalance { VendorProfileId = vendorProfile.Id };
                    db.VendorBalances.Add(vendorBalance);
                }
                vendorBalance.AvailableBalanceCents += actualVendorCents;
                vendorBalance.LifetimeEarnedCents += actualVendorCents;
                vendorBalance.UpdatedAt = DateTime.UtcNow;

                // Update job status
                job.Status = JobStatus.Paid;
                job.UpdatedAt = DateTime.UtcNow;
                job.Assignment.ConfirmedAt = DateTime.UtcNow;
                vendorProfile.TotalJobsCompleted += 1;

                // Create payment transaction record
                db.PaymentTransactions.Add(new PaymentTransaction
                {
                    JobRequestId = job.Id,
                    StripePaymentIntentId = escrow.StripePaymentIntentId,
                    AmountCents = captureAmountCents,
                    PlatformFeeCents = escrow.PlatformFeeCents,
                    VendorEarnedCents = actualVendorCents,
                    Status = PaymentStatus.Captured,
                    CapturedAt = DateTime.UtcNow
                });

                // Notify both parties
                await notifications.SendInAppNotificationAsync(
                    job.CustomerProfile.UserId, "payment_auto_released",
                    "Payment automatically released",
                    $"Payment for \"{job.Title}\" was automatically released after 48 hours. The vendor has been paid.",
                    new { jobId = job.Id }, ct);

                await notifications.SendInAppNotificationAsync(
                    vendorProfile.UserId, "payment_released",
                    $"Payment received: ${escrow.VendorAmountCents / 100.0:F2}",
                    $"Payment for \"{job.Title}\" was automatically released to your balance.",
                    new { jobId = job.Id }, ct);

                logger.LogInformation("Auto-released payment for job {JobId} after 48h", job.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to auto-release payment for job {JobId}", job.Id);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task SpawnInstance(
        IAppDbContext db,
        IPaymentService paymentService,
        ICommissionService commissionService,
        INotificationService notifications,
        RecurringJobSeries series,
        CancellationToken ct)
    {
        var template = series.TemplateJob;

        // Check card before spawning
        var card = await db.CustomerPaymentMethods
            .FirstOrDefaultAsync(pm => pm.CustomerProfileId == series.CustomerProfileId && pm.IsDefault, ct);

        if (card is null || (card.ExpMonth > 0 && IsCardExpired(card.ExpMonth, card.ExpYear)))
        {
            series.Status = RecurringSeriesStatus.PaymentRequired;
            await notifications.SendInAppNotificationAsync(
                series.CustomerProfile.UserId,
                "payment_required",
                "Recurring job paused — update payment",
                "Your card on file has expired. Update your payment method to resume.",
                new { seriesId = series.Id }, ct);
            await db.SaveChangesAsync(ct);
            return;
        }

        // Create the child job instance
        var childJob = new JobRequest
        {
            CustomerProfileId = series.CustomerProfileId,
            Title = template.Title,
            Description = template.Description,
            Categories = template.Categories.ToList(),
            Address = template.Address,
            Location = template.Location,
            Status = series.AssignedVendorProfileId.HasValue ? JobStatus.Assigned : JobStatus.Open,
            BudgetCents = template.BudgetCents,
            PricingType = template.PricingType,
            HourlyRateCents = template.HourlyRateCents,
            EstimatedHours = template.EstimatedHours,
            MaxHours = template.MaxHours,
            JobDetailsJson = template.JobDetailsJson,
            ScheduleStart = series.NextOccurrence,
            ScheduleEnd = series.NextOccurrence?.AddHours(4), // 4-hour window
            IsRecurring = true,
            ParentJobId = series.TemplateJobId,
            ExpiresAt = series.NextOccurrence?.AddDays(1)
        };

        db.JobRequests.Add(childJob);
        await db.SaveChangesAsync(ct);

        // If vendor is assigned, create a synthetic request + assignment
        if (series.AssignedVendorProfileId.HasValue)
        {
            var vendorRequest = new VendorRequest
            {
                JobRequestId = childJob.Id,
                VendorProfileId = series.AssignedVendorProfileId.Value,
                Status = VendorRequestStatus.Accepted,
                Note = "Auto-assigned from recurring series"
            };
            db.VendorRequests.Add(vendorRequest);
            await db.SaveChangesAsync(ct);

            db.JobAssignments.Add(new JobAssignment
            {
                JobRequestId = childJob.Id,
                VendorProfileId = series.AssignedVendorProfileId.Value,
                VendorRequestId = vendorRequest.Id,
                AssignedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync(ct);
        }

        // Payment: For fixed-price recurring, charge immediately (vendor already assigned).
        // For hourly recurring, place auth hold (will be partial-captured on verification).
        var fees = await commissionService.CalculateFeesAsync(
            template.BudgetCents, Guid.Empty, template.Categories.ToArray(), ct);

        if (template.PricingType == "hourly")
        {
            // Hourly: auth hold only — partial capture at verification
            var authResult = await paymentService.AuthorizePaymentAsync(
                card.StripeCustomerId, card.StripePaymentMethodId,
                fees.TotalChargeCents, "usd", $"auth_recurring_{childJob.Id}",
                $"Rakr recurring hold: {template.Title[..Math.Min(template.Title.Length, 25)]}", ct);

            if (authResult.Succeeded)
            {
                db.EscrowTransactions.Add(new EscrowTransaction
                {
                    JobRequestId = childJob.Id,
                    CustomerProfileId = series.CustomerProfileId,
                    StripePaymentIntentId = authResult.PaymentIntentId,
                    AmountCents = fees.TotalChargeCents,
                    BudgetCents = fees.BudgetCents,
                    TrustFeeCents = fees.TrustFeeCents,
                    ProcessingFeeCents = fees.ProcessingFeeCents,
                    PlatformFeeCents = fees.PlatformRevenueCents,
                    VendorAmountCents = fees.BudgetCents,
                    Status = EscrowStatus.Authorized
                });
            }
            else
            {
                series.Status = RecurringSeriesStatus.PaymentRequired;
                await notifications.SendInAppNotificationAsync(
                    series.CustomerProfile.UserId,
                    "payment_failed",
                    "Recurring payment authorization failed",
                    "We couldn't authorize your card for your recurring hourly job. Please update your payment method.",
                    new { seriesId = series.Id }, ct);
            }
        }
        else
        {
            // Fixed: charge immediately (vendor is assigned, capture directly)
            var chargeResult = await paymentService.ChargeCustomerAsync(
                card.StripeCustomerId, card.StripePaymentMethodId,
                fees.TotalChargeCents, "usd", $"escrow_{childJob.Id}",
                $"Rakr recurring: {template.Title[..Math.Min(template.Title.Length, 25)]}", ct);

            if (chargeResult.Succeeded)
            {
                db.EscrowTransactions.Add(new EscrowTransaction
                {
                    JobRequestId = childJob.Id,
                    CustomerProfileId = series.CustomerProfileId,
                    StripePaymentIntentId = chargeResult.PaymentIntentId,
                    AmountCents = fees.TotalChargeCents,
                    BudgetCents = fees.BudgetCents,
                    TrustFeeCents = fees.TrustFeeCents,
                    ProcessingFeeCents = fees.ProcessingFeeCents,
                    PlatformFeeCents = fees.PlatformRevenueCents,
                    VendorAmountCents = fees.BudgetCents,
                    Status = EscrowStatus.Held
                });
            }
            else
            {
                series.Status = RecurringSeriesStatus.PaymentRequired;
                await notifications.SendInAppNotificationAsync(
                    series.CustomerProfile.UserId,
                    "payment_failed",
                    "Recurring payment failed",
                    "We couldn't charge your card for your recurring job. Please update your payment method.",
                    new { seriesId = series.Id }, ct);
            }
        }

        // Update series tracking
        series.LastSpawnedAt = DateTime.UtcNow;
        series.TotalOccurrences++;
        series.NextOccurrence = CalculateNextOccurrence(series);

        // Notify vendor
        if (series.AssignedVendorProfileId.HasValue)
        {
            var vendor = await db.VendorProfiles.FirstOrDefaultAsync(
                v => v.Id == series.AssignedVendorProfileId.Value, ct);
            if (vendor != null)
            {
                await notifications.SendInAppNotificationAsync(
                    vendor.UserId, "recurring_job_scheduled",
                    $"Recurring job: {template.Title}",
                    "A new occurrence of your recurring job is ready. Check your schedule.",
                    new { jobId = childJob.Id }, ct);
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Spawned recurring instance {ChildJobId} for series {SeriesId}", childJob.Id, series.Id);
    }

    public static DateTime? CalculateNextOccurrence(RecurringJobSeries series)
    {
        if (series.Days.Count == 0) return null;

        var baseDate = series.LastSpawnedAt?.Date ?? DateTime.UtcNow.Date;
        var timeParts = series.Time.Split(':');
        var hour = int.Parse(timeParts[0]);
        var minute = timeParts.Length > 1 ? int.Parse(timeParts[1]) : 0;

        // Determine increment based on frequency
        var daysToAdd = series.Frequency switch
        {
            "weekly" => 7,
            "biweekly" => 14,
            "monthly" => 28, // approximate
            _ => 7
        };

        // Find the next matching day
        var candidate = baseDate.AddDays(1);
        var maxSearch = daysToAdd + 7; // search window

        for (var i = 0; i < maxSearch; i++)
        {
            if (series.Days.Contains(candidate.DayOfWeek.ToString()))
            {
                return new DateTime(candidate.Year, candidate.Month, candidate.Day, hour, minute, 0, DateTimeKind.Utc);
            }
            candidate = candidate.AddDays(1);
        }

        // Fallback: just add the increment
        return baseDate.AddDays(daysToAdd).Date.AddHours(hour).AddMinutes(minute);
    }

    private static bool IsCardExpired(int expiryMonth, int expiryYear)
    {
        var now = DateTime.UtcNow;
        if (expiryYear < now.Year) return true;
        if (expiryYear == now.Year && expiryMonth < now.Month) return true;
        return false;
    }
}
