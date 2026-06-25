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
    ICommissionService commissionService
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
        if (currentUser.UserId is null) return Unauthorized();

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .Include(j => j.Assignment!).ThenInclude(a => a.VendorProfile)
            .FirstOrDefaultAsync(j => j.Id == body.JobRequestId);

        if (job is null) return NotFound("Job not found.");
        if (job.CustomerProfile.UserId != currentUser.UserId.Value)
            return BadRequest(new { errors = new[] { "Only the customer can pay for this job." } });
        if (job.Status != JobStatus.Completed)
            return BadRequest(new { errors = new[] { "Job must be in Completed status to pay." } });

        // Idempotency: check if already paid
        var existing = await db.PaymentTransactions
            .AnyAsync(pt => pt.JobRequestId == job.Id && pt.Status == PaymentStatus.Captured);
        if (existing) return Ok(new { message = "Already paid.", alreadyPaid = true });

        // Get customer's default card
        var card = await db.CustomerPaymentMethods
            .FirstOrDefaultAsync(pm => pm.CustomerProfileId == job.CustomerProfile.Id && pm.IsDefault);
        if (card is null)
            return BadRequest(new { errors = new[] { "No payment method on file. Please add a card." } });

        // Calculate fees
        var vendorProfile = job.Assignment!.VendorProfile;
        var fees = await commissionService.CalculateFeesAsync(
            job.BudgetCents, vendorProfile.Id, job.Categories.ToArray());

        // Charge the saved card (money goes to platform's Stripe balance)
        var idempotencyKey = $"charge_{job.Id}";
        var result = await paymentService.ChargeCustomerAsync(
            card.StripeCustomerId, card.StripePaymentMethodId,
            fees.GrossAmountCents, "usd", idempotencyKey,
            $"YardGig job: {job.Title[..Math.Min(job.Title.Length, 40)]}");

        if (!result.Succeeded)
            return BadRequest(new { errors = new[] { result.ErrorMessage ?? "Payment failed." } });

        // Create transaction record
        var transaction = new PaymentTransaction
        {
            JobRequestId = job.Id,
            StripePaymentIntentId = result.PaymentIntentId,
            StripeCustomerId = card.StripeCustomerId,
            AmountCents = fees.GrossAmountCents,
            PlatformFeeCents = fees.PlatformFeeCents,
            VendorEarnedCents = fees.VendorNetCents,
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

        vendorBalance.AvailableBalanceCents += fees.VendorNetCents;
        vendorBalance.LifetimeEarnedCents += fees.VendorNetCents;
        vendorBalance.UpdatedAt = DateTime.UtcNow;

        // Ledger entries
        db.LedgerEntries.Add(new LedgerEntry
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "payment_received",
            Account = "customer_charge",
            DebitCents = fees.GrossAmountCents,
            Description = $"Customer payment for job: {job.Title}",
            IdempotencyKey = $"ledger_{transaction.Id}_received"
        });
        db.LedgerEntries.Add(new LedgerEntry
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "platform_fee",
            Account = "platform_revenue",
            DebitCents = fees.PlatformFeeCents,
            IdempotencyKey = $"ledger_{transaction.Id}_fee"
        });
        db.LedgerEntries.Add(new LedgerEntry
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "vendor_earned",
            Account = "vendor_balance",
            DebitCents = fees.VendorNetCents,
            IdempotencyKey = $"ledger_{transaction.Id}_vendor",
            RelatedEntityId = vendorProfile.Id
        });

        // Update job status
        job.Status = JobStatus.Paid;
        job.UpdatedAt = DateTime.UtcNow;
        if (job.Assignment is not null) job.Assignment.ConfirmedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Ok(new { transactionId = transaction.Id, vendorEarnedCents = fees.VendorNetCents });
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
