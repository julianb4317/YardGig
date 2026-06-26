using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Domain.Entities;
using YardGig.Domain.Enums;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PaymentsController(
    IAppDbContext db,
    ICurrentUserService currentUser,
    IPaymentService paymentService,
    ICommissionService commissionService,
    YardGig.Infrastructure.Services.JobNotifications jobNotifications
) : ControllerBase
{
    // ─────────────── CUSTOMER: CARD MANAGEMENT ───────────────

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

        if (profile is null) return NotFound("Customer profile not found.");

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
            YardGig.Domain.Entities.EscrowTransaction? escrow = null;
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
                // ESCROW EXISTS: Release held funds to vendor
                escrow.Status = EscrowStatus.Released;
                escrow.ReleasedAt = DateTime.UtcNow;
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
                    fees.GrossAmountCents, "usd", $"charge_{job.Id}",
                    $"YardGig: {job.Title[..Math.Min(job.Title.Length, 30)]}");

                if (!result.Succeeded)
                    return BadRequest(new { errors = new[] { result.ErrorMessage ?? "Payment failed." } });

                amountCents = fees.GrossAmountCents;
                platformFeeCents = fees.PlatformFeeCents;
                vendorNetCents = fees.VendorNetCents;
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
            _ = jobNotifications.NotifyPaymentReleased(job.Id, vendorProfile.UserId, vendorNetCents);

            return Ok(new { transactionId = transaction.Id, vendorEarnedCents = vendorNetCents, vendorUserId = vendorProfile.UserId });
        }
        catch (Exception ex)
        {
            var inner = ex; while (inner.InnerException != null) inner = inner.InnerException;
            return StatusCode(500, new { error = ex.Message, rootCause = inner.Message });
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
}

public record ChargeJobBody(Guid JobRequestId);
public record AddPaymentMethodBody(string CardNumber, int ExpMonth, int ExpYear, string NameOnCard);
