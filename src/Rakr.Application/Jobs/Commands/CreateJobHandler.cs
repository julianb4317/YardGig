using MediatR;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Common.Models;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;
using Rakr.Domain.Events;

namespace Rakr.Application.Jobs.Commands;

public class CreateJobHandler(
    IAppDbContext db,
    IGeocodingService geocoding,
    ICurrentUserService currentUser,
    IPaymentService paymentService,
    ICommissionService commissionService
) : IRequestHandler<CreateJobCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateJobCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<Guid>.Failure("Unauthorized.");

        // Ensure domain User and CustomerProfile exist
        var customerProfile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value, cancellationToken);

        if (customerProfile is null)
        {
            // Check if domain user exists
            var domainUser = await db.Users.FindAsync([currentUser.UserId.Value], cancellationToken);
            if (domainUser is null)
            {
                db.Users.Add(new ApplicationUser
                {
                    Id = currentUser.UserId.Value,
                    Email = currentUser.Email ?? "",
                    DisplayName = currentUser.Email ?? "User",
                    EmailVerified = true,
                    AuthProvider = "local",
                    IsActive = true
                });
            }

            customerProfile = new CustomerProfile { UserId = currentUser.UserId.Value };
            db.CustomerProfiles.Add(customerProfile);

            // Save user + profile first, before the job (FK dependency)
            await db.SaveChangesAsync(cancellationToken);
        }

        var location = await geocoding.GeocodeAddressAsync(request.Address, cancellationToken);
        if (location is null)
            return Result<Guid>.Failure("We couldn't locate this address. Please refine it.");

        // For recurring jobs, verify card exists (payment charged per occurrence, not upfront)
        if (request.IsRecurring)
        {
            var hasCard = await db.CustomerPaymentMethods
                .AnyAsync(pm => pm.CustomerProfileId == customerProfile.Id && pm.IsDefault, cancellationToken);
            if (!hasCard)
                return Result<Guid>.Failure("A payment method is required for recurring jobs. Please add a card first.");
        }

        var job = new JobRequest
        {
            CustomerProfileId = customerProfile.Id,
            Title = request.Title,
            Description = request.Description,
            Categories = request.Categories.ToList(),
            Address = request.Address,
            Location = location,
            Status = JobStatus.Open,
            BudgetCents = request.BudgetCents,
            ScheduleStart = request.ScheduleStart,
            ScheduleEnd = request.ScheduleEnd,
            Photos = request.Photos?.ToList(),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRecurring = request.IsRecurring,
            RecurringFrequency = request.RecurringFrequency,
            RecurringDays = request.RecurringDays?.ToList(),
            RecurringTime = request.RecurringTime
        };

        job.AddDomainEvent(new JobCreatedEvent(job.Id));

        db.JobRequests.Add(job);
        await db.SaveChangesAsync(cancellationToken);

        // For recurring jobs, create the series (no upfront escrow — charged per occurrence)
        if (request.IsRecurring)
        {
            var series = new RecurringJobSeries
            {
                CustomerProfileId = customerProfile.Id,
                TemplateJobId = job.Id,
                Frequency = request.RecurringFrequency ?? "weekly",
                Days = request.RecurringDays?.ToList() ?? [],
                Time = request.RecurringTime ?? "09:00",
                Status = RecurringSeriesStatus.Active,
            };
            series.NextOccurrence = CalculateNextOccurrenceForNew(series);
            db.RecurringJobSeries.Add(series);
            await db.SaveChangesAsync(cancellationToken);

            return Result<Guid>.Success(job.Id);
        }

        // ESCROW: Charge customer's card and hold funds (one-off jobs only)
        var card = await db.CustomerPaymentMethods
            .FirstOrDefaultAsync(pm => pm.CustomerProfileId == customerProfile.Id && pm.IsDefault, cancellationToken);

        if (card is not null)
        {
            var fees = await commissionService.CalculateFeesAsync(
                request.BudgetCents, Guid.Empty, request.Categories, cancellationToken);

            var chargeResult = await paymentService.ChargeCustomerAsync(
                card.StripeCustomerId, card.StripePaymentMethodId,
                fees.GrossAmountCents, "usd", $"escrow_{job.Id}",
                $"Rakr escrow: {request.Title[..Math.Min(request.Title.Length, 30)]}", cancellationToken);

            if (chargeResult.Succeeded)
            {
                db.EscrowTransactions.Add(new EscrowTransaction
                {
                    JobRequestId = job.Id,
                    CustomerProfileId = customerProfile.Id,
                    StripePaymentIntentId = chargeResult.PaymentIntentId,
                    AmountCents = fees.GrossAmountCents,
                    PlatformFeeCents = fees.PlatformFeeCents,
                    VendorAmountCents = fees.VendorNetCents,
                    Status = EscrowStatus.Held
                });
                await db.SaveChangesAsync(cancellationToken);
            }
            // If charge fails, job is still created but without escrow (customer can add card later)
        }

        return Result<Guid>.Success(job.Id);
    }

    private static DateTime? CalculateNextOccurrenceForNew(RecurringJobSeries series)
    {
        if (series.Days.Count == 0) return null;

        var timeParts = series.Time.Split(':');
        var hour = int.Parse(timeParts[0]);
        var minute = timeParts.Length > 1 ? int.Parse(timeParts[1]) : 0;

        // Find the next matching day from today
        var candidate = DateTime.UtcNow.Date.AddDays(1);
        for (var i = 0; i < 30; i++)
        {
            if (series.Days.Contains(candidate.DayOfWeek.ToString()))
            {
                return new DateTime(candidate.Year, candidate.Month, candidate.Day, hour, minute, 0, DateTimeKind.Utc);
            }
            candidate = candidate.AddDays(1);
        }

        return DateTime.UtcNow.Date.AddDays(7).AddHours(hour).AddMinutes(minute);
    }
}
