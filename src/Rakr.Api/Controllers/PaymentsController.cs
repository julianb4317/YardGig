using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PaymentsController(
    IAppDbContext db,
    ICurrentUserService currentUser,
    IPaymentService paymentService,
    ICommissionService commissionService,
    Rakr.Infrastructure.Services.JobNotifications jobNotifications
) : ControllerBase
{
    // ─────────────── CUSTOMER: CARD MANAGEMENT ───────────────

    /// <summary>
    /// Preview fee breakdown for a given budget amount.
    /// Used on the job creation page to show the customer what they'll be charged.
    /// </summary>
    [HttpGet("fee-preview")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetFeePreview([FromQuery] int budgetCents)
    {
        if (budgetCents < 100) return BadRequest(new { errors = new[] { "Budget must be at least $1." } });

        var fees = await commissionService.CalculateFeesAsync(budgetCents, Guid.Empty, Array.Empty<string>());

        return Ok(new
        {
            budgetCents = fees.BudgetCents,
            trustFeeCents = fees.TrustFeeCents,
            processingFeeCents = fees.ProcessingFeeCents,
            totalChargeCents = fees.TotalChargeCents
        });
    }

    /// <summary>
    /// Create a Stripe SetupIntent so the frontend can collect and save the customer's card.
    /// Called during registration or when adding a new card.
    /// </summary>
    [HttpPost("setup-intent")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> CreateSetupIntent()
    {
        if (currentUser.UserId is null) return Unauthorized();

        var profile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);

        if (profile is null) return NotFound(new { errors = new[] { "Customer profile not found." } });

        // Ensure Stripe Customer exists
        if (string.IsNullOrEmpty(profile.StripeCustomerId))
        {
            var user = await db.Users.FindAsync(currentUser.UserId.Value);
            var customerId = await paymentService.CreateStripeCustomerAsync(user!.Email, user.DisplayName);
            profile.StripeCustomerId = customerId;
            await db.SaveChangesAsync();
        }

        var clientSecret = await paymentService.CreateSetupIntentAsync(profile.StripeCustomerId);

        return Ok(new { clientSecret, stripeCustomerId = profile.StripeCustomerId });
    }

    /// <summary>
    /// List customer's saved payment methods.
    /// </summary>
    [HttpGet("methods")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetPaymentMethods()
    {
        var methods = await db.CustomerPaymentMethods
            .AsNoTracking()
            .Where(pm => pm.CustomerProfile.UserId == currentUser.UserId)
            .Select(pm => new
            {
                pm.Id, pm.CardLast4, pm.CardBrand, pm.ExpMonth, pm.ExpYear, pm.IsDefault
            })
            .ToListAsync();

        return Ok(methods);
    }

    /// <summary>
    /// Save a payment method directly (development mode — no Stripe required).
    /// In production, this would be handled via Stripe SetupIntent + webhook.
    /// </summary>
    [HttpPost("methods")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> AddPaymentMethod([FromBody] AddPaymentMethodBody body)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var profile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);

        if (profile is null)
        {
            // Auto-create profile
            var domainUser = await db.Users.FindAsync(currentUser.UserId.Value);
            if (domainUser is null)
            {
                db.Users.Add(new Domain.Entities.ApplicationUser
                {
                    Id = currentUser.UserId.Value,
                    Email = currentUser.Email ?? "",
                    DisplayName = currentUser.Email ?? "User",
                    EmailVerified = true, AuthProvider = "local", IsActive = true
                });
            }
            profile = new Domain.Entities.CustomerProfile { UserId = currentUser.UserId.Value };
            db.CustomerProfiles.Add(profile);
            await db.SaveChangesAsync();
        }

        // Mark existing as non-default
        var existing = await db.CustomerPaymentMethods
            .Where(pm => pm.CustomerProfileId == profile.Id)
            .ToListAsync();
        foreach (var e in existing) e.IsDefault = false;

        var method = new Domain.Entities.CustomerPaymentMethod
        {
            CustomerProfileId = profile.Id,
            StripePaymentMethodId = $"pm_dev_{Guid.NewGuid():N}",
            StripeCustomerId = profile.StripeCustomerId ?? $"cus_dev_{Guid.NewGuid():N}",
            CardLast4 = body.CardNumber.Length >= 4 ? body.CardNumber[^4..] : body.CardNumber,
            CardBrand = DetectCardBrand(body.CardNumber),
            ExpMonth = body.ExpMonth,
            ExpYear = body.ExpYear,
            IsDefault = true
        };

        db.CustomerPaymentMethods.Add(method);
        await db.SaveChangesAsync();

        return Ok(new { id = method.Id, method.CardLast4, method.CardBrand });
    }

    private static string DetectCardBrand(string number)
    {
        if (number.StartsWith('4')) return "visa";
        if (number.StartsWith("5") || number.StartsWith("2")) return "mastercard";
        if (number.StartsWith("3")) return "amex";
        if (number.StartsWith("6")) return "discover";
        return "card";
    }

    /// <summary>
    /// Remove a saved payment method.
    /// </summary>
    [HttpDelete("methods/{id:guid}")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> RemovePaymentMethod(Guid id)
    {
        var method = await db.CustomerPaymentMethods
            .Include(pm => pm.CustomerProfile)
            .FirstOrDefaultAsync(pm => pm.Id == id && pm.CustomerProfile.UserId == currentUser.UserId);

        if (method is null) return NotFound();

        // Detach from Stripe
        await paymentService.DetachPaymentMethodAsync(method.StripePaymentMethodId);

        db.CustomerPaymentMethods.Remove(method);
        await db.SaveChangesAsync();

        return Ok(new { message = "Payment method removed." });
    }

    // ─────────────── CUSTOMER: CHARGE FOR JOB ───────────────

    /// <summary>
    /// Charge the customer's saved card for a completed job.
    /// Money goes to platform balance; vendor balance is credited.
    /// </summary>
    [HttpPost("charge")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> ChargeForJob([FromBody] ChargeJobBody body)
    {
        try
        {
            if (currentUser.UserId is null) return Unauthorized();

            var job = await db.JobRequests
                .Include(j => j.CustomerProfile)
                .Include(j => j.Assignment!)
                    .ThenInclude(a => a.VendorProfile)
                .FirstOrDefaultAsync(j => j.Id == body.JobRequestId);

            if (job is null)
                return NotFound(new { errors = new[] { "Job not found." } });

            if (job.CustomerProfile == null || job.CustomerProfile.UserId != currentUser.UserId.Value)
                return BadRequest(new { errors = new[] { "Only the customer can verify payment." } });

            if (job.Status != JobStatus.Completed)
                return BadRequest(new { errors = new[] { $"Job must be in Completed status. Current: {job.Status}" } });

            // Idempotency
            var alreadyPaid = await db.PaymentTransactions
                .AnyAsync(pt => pt.JobRequestId == job.Id && pt.Status == PaymentStatus.Captured);
            if (alreadyPaid) return Ok(new { message = "Already paid.", alreadyPaid = true });

            if (job.Assignment?.VendorProfile == null)
                return BadRequest(new { errors = new[] { "No vendor assigned." } });

            var vendorProfile = job.Assignment.VendorProfile;

            // Check for existing escrow (graceful if table doesn't exist)
            Rakr.Domain.Entities.EscrowTransaction? escrow = null;
            try
            {
                escrow = await db.EscrowTransactions
                    .FirstOrDefaultAsync(e => e.JobRequestId == job.Id && e.Status == EscrowStatus.Held);
            }
            catch
            {
                // Table might not exist yet — proceed without escrow
            }

            int amountCents, platformFeeCents, vendorNetCents;
            string? paymentIntentId = null;

            if (escrow is not null)
            {
                // ESCROW EXISTS: Capture the authorization hold (card is charged NOW)
                // Then release funds to vendor
                if (escrow.Status == EscrowStatus.Authorized && !string.IsNullOrEmpty(escrow.StripePaymentIntentId))
                {
                    var captureResult = await paymentService.CapturePaymentAsync(escrow.StripePaymentIntentId);
                    if (!captureResult.Succeeded)
                        return BadRequest(new { errors = new[] { "Failed to capture payment. Please try again." } });
                }

                escrow.Status = EscrowStatus.Released;
                escrow.ReleasedAt = DateTime.UtcNow;
                escrow.CapturedAt ??= DateTime.UtcNow;
                amountCents = escrow.AmountCents;
                platformFeeCents = escrow.PlatformFeeCents;
                vendorNetCents = escrow.VendorAmountCents;
                paymentIntentId = escrow.StripePaymentIntentId;
            }
            else
            {
                // NO ESCROW: Charge card now (fallback for jobs created before escrow)
                var card = await db.CustomerPaymentMethods
                    .FirstOrDefaultAsync(pm => pm.CustomerProfileId == job.CustomerProfile.Id && pm.IsDefault);
                if (card is null)
                    return BadRequest(new { errors = new[] { "No payment method on file. Please add a card in Settings." } });

                var fees = await commissionService.CalculateFeesAsync(
                    job.BudgetCents, vendorProfile.Id, job.Categories.ToArray());

                var result = await paymentService.ChargeCustomerAsync(
                    card.StripeCustomerId, card.StripePaymentMethodId,
                    fees.TotalChargeCents, "usd", $"charge_{job.Id}",
                    $"Rakr: {job.Title[..Math.Min(job.Title.Length, 30)]}");

                if (!result.Succeeded)
                    return BadRequest(new { errors = new[] { result.ErrorMessage ?? "Payment failed." } });

                amountCents = fees.TotalChargeCents;
                platformFeeCents = fees.PlatformRevenueCents;
                vendorNetCents = fees.BudgetCents; // Vendor gets full budget
                paymentIntentId = result.PaymentIntentId;
            }

            // Create transaction record
            var transaction = new PaymentTransaction
            {
                JobRequestId = job.Id,
                StripePaymentIntentId = paymentIntentId,
                StripeCustomerId = job.CustomerProfile.StripeCustomerId,
                AmountCents = amountCents,
                PlatformFeeCents = platformFeeCents,
                VendorEarnedCents = vendorNetCents,
                Status = PaymentStatus.Captured,
                CapturedAt = DateTime.UtcNow
            };
            db.PaymentTransactions.Add(transaction);

            // Credit vendor balance
            var vendorBalance = await db.VendorBalances
                .FirstOrDefaultAsync(vb => vb.VendorProfileId == vendorProfile.Id);
            if (vendorBalance is null)
            {
                vendorBalance = new VendorBalance { VendorProfileId = vendorProfile.Id };
                db.VendorBalances.Add(vendorBalance);
            }
            vendorBalance.AvailableBalanceCents += vendorNetCents;
            vendorBalance.LifetimeEarnedCents += vendorNetCents;
            vendorBalance.UpdatedAt = DateTime.UtcNow;

            // Update job status
            job.Status = JobStatus.Paid;
            job.UpdatedAt = DateTime.UtcNow;
            if (job.Assignment is not null) job.Assignment.ConfirmedAt = DateTime.UtcNow;

            // Increment vendor's completed jobs count
            vendorProfile.TotalJobsCompleted += 1;
            vendorProfile.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync();

            // Notify vendor of payment
            try { await jobNotifications.NotifyPaymentReleased(job.Id, vendorProfile.UserId, vendorNetCents); } catch { /* non-fatal */ }

            return Ok(new { transactionId = transaction.Id, vendorEarnedCents = vendorNetCents, vendorUserId = vendorProfile.UserId });
        }
        catch (Exception ex)
        {
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<PaymentsController>>();
            logger.LogError(ex, "Unhandled error in {Action}", nameof(ChargeForJob));
            return StatusCode(500, new { errors = new[] { "An unexpected error occurred. Please try again." } });
        }
    }

    // ─────────────── CUSTOMER: CHARGE HOURLY JOB ───────────────

    /// <summary>
    /// Verify and release payment for an hourly job with actual hours.
    /// Customer can approve calculated hours or adjust.
    /// </summary>
    [HttpPost("charge-hourly")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> ChargeHourlyJob([FromBody] ChargeHourlyBody body)
    {
        try
        {
            if (currentUser.UserId is null) return Unauthorized();

            var job = await db.JobRequests
                .Include(j => j.CustomerProfile)
                .Include(j => j.Assignment!)
                    .ThenInclude(a => a.VendorProfile)
                .FirstOrDefaultAsync(j => j.Id == body.JobRequestId);

            if (job is null)
                return NotFound(new { errors = new[] { "Job not found." } });

            if (job.CustomerProfile == null || job.CustomerProfile.UserId != currentUser.UserId.Value)
                return BadRequest(new { errors = new[] { "Only the customer can verify payment." } });

            if (job.Status != JobStatus.Completed)
                return BadRequest(new { errors = new[] { $"Job must be in Completed status. Current: {job.Status}" } });

            if (job.PricingType != "hourly")
                return BadRequest(new { errors = new[] { "This endpoint is only for hourly jobs. Use /charge for fixed-price jobs." } });

            // Idempotency
            var alreadyPaid = await db.PaymentTransactions
                .AnyAsync(pt => pt.JobRequestId == job.Id && pt.Status == PaymentStatus.Captured);
            if (alreadyPaid) return Ok(new { message = "Already paid.", alreadyPaid = true });

            if (job.Assignment?.VendorProfile == null)
                return BadRequest(new { errors = new[] { "No vendor assigned." } });

            var vendorProfile = job.Assignment.VendorProfile;

            // Cap approved hours at MaxHours
            var cappedHours = job.MaxHours.HasValue
                ? Math.Min(body.ApprovedHours, job.MaxHours.Value)
                : body.ApprovedHours;

            if (cappedHours <= 0)
                return BadRequest(new { errors = new[] { "Approved hours must be greater than zero." } });

            // Calculate the actual charge based on approved hours
            var actualBudgetCents = (int)Math.Ceiling((double)cappedHours * (double)job.HourlyRateCents!.Value);

            // Calculate fees on the actual amount
            var fees = await commissionService.CalculateFeesAsync(
                actualBudgetCents, vendorProfile.Id, job.Categories.ToArray());

            // Find the escrow (status = Held or Authorized)
            var escrow = await db.EscrowTransactions
                .FirstOrDefaultAsync(e => e.JobRequestId == job.Id
                    && (e.Status == EscrowStatus.Held || e.Status == EscrowStatus.Authorized));

            if (escrow is null || string.IsNullOrEmpty(escrow.StripePaymentIntentId))
                return BadRequest(new { errors = new[] { "No escrow hold found for this job." } });

            // Do a PARTIAL capture for the actual amount (which may be less than the auth hold)
            var captureResult = await paymentService.CapturePaymentAsync(
                escrow.StripePaymentIntentId, fees.TotalChargeCents);

            if (!captureResult.Succeeded)
                return BadRequest(new { errors = new[] { captureResult.ErrorMessage ?? "Payment capture failed." } });

            // Update escrow with actual amounts
            escrow.Status = EscrowStatus.Released;
            escrow.ReleasedAt = DateTime.UtcNow;
            escrow.AmountCents = fees.TotalChargeCents;
            escrow.BudgetCents = actualBudgetCents;
            escrow.VendorAmountCents = actualBudgetCents;
            escrow.TrustFeeCents = fees.TrustFeeCents;
            escrow.ProcessingFeeCents = fees.ProcessingFeeCents;
            escrow.PlatformFeeCents = fees.TrustFeeCents;

            // Create transaction record
            var transaction = new PaymentTransaction
            {
                JobRequestId = job.Id,
                StripePaymentIntentId = captureResult.PaymentIntentId,
                StripeCustomerId = job.CustomerProfile.StripeCustomerId,
                AmountCents = fees.TotalChargeCents,
                PlatformFeeCents = fees.PlatformRevenueCents,
                VendorEarnedCents = actualBudgetCents,
                Status = PaymentStatus.Captured,
                CapturedAt = DateTime.UtcNow
            };
            db.PaymentTransactions.Add(transaction);

            // Credit vendor balance
            var vendorBalance = await db.VendorBalances
                .FirstOrDefaultAsync(vb => vb.VendorProfileId == vendorProfile.Id);
            if (vendorBalance is null)
            {
                vendorBalance = new VendorBalance { VendorProfileId = vendorProfile.Id };
                db.VendorBalances.Add(vendorBalance);
            }
            vendorBalance.AvailableBalanceCents += actualBudgetCents;
            vendorBalance.LifetimeEarnedCents += actualBudgetCents;
            vendorBalance.UpdatedAt = DateTime.UtcNow;

            // Update job status
            job.Status = JobStatus.Paid;
            job.UpdatedAt = DateTime.UtcNow;
            if (job.Assignment is not null) job.Assignment.ConfirmedAt = DateTime.UtcNow;

            // Increment vendor's completed jobs count
            vendorProfile.TotalJobsCompleted += 1;
            vendorProfile.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync();

            // Notify vendor of payment
            try { await jobNotifications.NotifyPaymentReleased(job.Id, vendorProfile.UserId, actualBudgetCents); } catch { /* non-fatal */ }

            return Ok(new
            {
                transactionId = transaction.Id,
                vendorEarnedCents = actualBudgetCents,
                actualHours = cappedHours,
                vendorUserId = vendorProfile.UserId
            });
        }
        catch (Exception ex)
        {
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<PaymentsController>>();
            logger.LogError(ex, "Unhandled error in {Action}", nameof(ChargeHourlyJob));
            return StatusCode(500, new { errors = new[] { "An unexpected error occurred. Please try again." } });
        }
    }

    // ─────────────── VENDOR: BALANCE & PAYOUTS ───────────────

    /// <summary>
    /// Get vendor's current balance and payout summary.
    /// </summary>
    [HttpGet("vendor/balance")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> GetVendorBalance()
    {
        var balance = await db.VendorBalances
            .AsNoTracking()
            .FirstOrDefaultAsync(vb => vb.VendorProfile.UserId == currentUser.UserId);

        if (balance is null)
            return Ok(new { availableBalanceCents = 0, pendingBalanceCents = 0, lifetimeEarnedCents = 0, lastPayoutAt = (DateTime?)null });

        return Ok(new
        {
            balance.AvailableBalanceCents,
            balance.PendingBalanceCents,
            balance.LifetimeEarnedCents,
            balance.LastPayoutAt
        });
    }

    /// <summary>
    /// Get vendor's payout history.
    /// </summary>
    [HttpGet("vendor/payouts")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> GetVendorPayouts([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = db.Payouts
            .AsNoTracking()
            .Where(p => p.VendorProfile.UserId == currentUser.UserId);

        var totalCount = await query.CountAsync();

        var payouts = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new { p.Id, p.AmountCents, p.Status, p.PaidAt, p.CreatedAt, p.FailureReason })
            .ToListAsync();

        return Ok(new { payouts, totalCount, page, pageSize });
    }

    /// <summary>
    /// Get actual earnings breakdown for the current vendor (from payment transactions).
    /// </summary>
    [HttpGet("vendor/earnings")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> GetVendorEarnings([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var vendorProfile = await db.VendorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value);

        if (vendorProfile is null)
            return Ok(new { earnings = Array.Empty<object>(), totalCount = 0, page, pageSize });

        var query = db.PaymentTransactions
            .AsNoTracking()
            .Include(pt => pt.JobRequest)
            .Where(pt => pt.Status == PaymentStatus.Captured
                && pt.JobRequest.Assignment != null
                && pt.JobRequest.Assignment.VendorProfileId == vendorProfile.Id);

        var totalCount = await query.CountAsync();

        var earnings = await query
            .OrderByDescending(pt => pt.CapturedAt ?? pt.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(pt => new
            {
                pt.Id,
                pt.JobRequestId,
                JobTitle = pt.JobRequest.Title,
                PricingType = pt.JobRequest.PricingType,
                HourlyRateCents = pt.JobRequest.HourlyRateCents,
                pt.VendorEarnedCents,
                pt.AmountCents,
                pt.CapturedAt,
                pt.CreatedAt
            })
            .ToListAsync();

        return Ok(new { earnings, totalCount, page, pageSize });
    }

    // ─────────────── PAYMENT STATUS ───────────────

    /// <summary>
    /// Get payment status for a specific job.
    /// </summary>
    [HttpGet("job/{jobId:guid}")]
    public async Task<IActionResult> GetPaymentStatus(Guid jobId)
    {
        var transaction = await db.PaymentTransactions
            .AsNoTracking()
            .Where(pt => pt.JobRequestId == jobId)
            .OrderByDescending(pt => pt.CreatedAt)
            .Select(pt => new { pt.Id, pt.Status, pt.AmountCents, pt.PlatformFeeCents, pt.VendorEarnedCents, pt.CapturedAt })
            .FirstOrDefaultAsync();

        if (transaction is null) return Ok(new { hasPayment = false });
        return Ok(new { hasPayment = true, transaction });
    }

    // ─────────────── CUSTOMER: RECEIPTS ───────────────

    /// <summary>
    /// Get payment receipts for the current customer, ordered by date (newest first).
    /// </summary>
    [HttpGet("receipts")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetReceipts([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var customerProfile = await db.CustomerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);

        if (customerProfile is null) return Ok(new { receipts = Array.Empty<object>(), totalCount = 0, page, pageSize });

        var query = db.PaymentTransactions
            .AsNoTracking()
            .Include(pt => pt.JobRequest)
            .Where(pt => pt.JobRequest.CustomerProfileId == customerProfile.Id
                && pt.Status == PaymentStatus.Captured);

        var totalCount = await query.CountAsync();

        var receipts = await query
            .OrderByDescending(pt => pt.CapturedAt ?? pt.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(pt => new
            {
                pt.Id,
                pt.JobRequestId,
                JobTitle = pt.JobRequest.Title,
                PricingType = pt.JobRequest.PricingType,
                pt.AmountCents,
                pt.PlatformFeeCents,
                pt.VendorEarnedCents,
                BudgetCents = pt.JobRequest.BudgetCents,
                HourlyRateCents = pt.JobRequest.HourlyRateCents,
                pt.CapturedAt,
                pt.CreatedAt
            })
            .ToListAsync();

        return Ok(new { receipts, totalCount, page, pageSize });
    }
}

public record ChargeJobBody(Guid JobRequestId);
public record ChargeHourlyBody(Guid JobRequestId, decimal ApprovedHours);
public record AddPaymentMethodBody(string CardNumber, int ExpMonth, int ExpYear, string NameOnCard);
