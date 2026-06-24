using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Entities;
using YardGig.Domain.Enums;
using YardGig.Domain.Events;

namespace YardGig.Application.Payments.Commands;

public class CapturePaymentHandler(
    IAppDbContext db,
    IPaymentService paymentService,
    ICommissionService commissionService,
    ICurrentUserService currentUser
) : IRequestHandler<CapturePaymentCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CapturePaymentCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<Guid>.Failure("Unauthorized.");

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .Include(j => j.Assignment!)
                .ThenInclude(a => a.VendorProfile)
            .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

        if (job is null)
            return Result<Guid>.Failure("Job not found.");

        if (job.CustomerProfile.UserId != currentUser.UserId.Value)
            return Result<Guid>.Failure("Only the customer can confirm payment.");

        if (job.Status != JobStatus.Completed)
            return Result<Guid>.Failure("Job must be in Completed status.");

        // Idempotency: check if already paid
        var existingTransaction = await db.PaymentTransactions
            .FirstOrDefaultAsync(pt => pt.JobRequestId == job.Id && pt.Status == PaymentStatus.Captured, cancellationToken);
        if (existingTransaction is not null)
            return Result<Guid>.Success(existingTransaction.Id); // Already captured

        var vendorProfile = job.Assignment!.VendorProfile;
        if (string.IsNullOrEmpty(vendorProfile.StripeAccountId))
            return Result<Guid>.Failure("Vendor has not set up payout information.");

        // Calculate fees using commission service
        var fees = await commissionService.CalculateFeesAsync(
            job.BudgetCents, vendorProfile.Id, job.Categories.ToArray(), cancellationToken);

        var idempotencyKey = $"pi_create_{job.Id}";
        var statementDescriptor = $"YARDGIG*{job.Title[..Math.Min(job.Title.Length, 14)]}";

        // Create and capture payment intent
        var piResult = await paymentService.CreatePaymentIntentAsync(
            fees.GrossAmountCents, "usd", vendorProfile.StripeAccountId,
            fees.PlatformFeeCents, idempotencyKey, statementDescriptor, cancellationToken);

        var captureKey = $"pi_capture_{piResult.PaymentIntentId}";
        var captured = await paymentService.CapturePaymentAsync(piResult.PaymentIntentId, captureKey, cancellationToken);

        if (!captured)
            return Result<Guid>.Failure("Payment capture failed. Please try again.");

        // Create payment transaction record
        var transaction = new PaymentTransaction
        {
            JobRequestId = job.Id,
            StripePaymentIntentId = piResult.PaymentIntentId,
            AmountCents = fees.GrossAmountCents,
            PlatformFeeCents = fees.PlatformFeeCents,
            VendorPayoutCents = fees.VendorNetCents,
            Currency = "usd",
            Status = PaymentStatus.Captured,
            CapturedAt = DateTime.UtcNow
        };
        db.PaymentTransactions.Add(transaction);

        // Create ledger entries
        var ledgerIdempotencyBase = $"ledger_{transaction.Id}";
        db.LedgerEntries.Add(new LedgerEntry
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "payment_received",
            Account = "customer_charge",
            DebitCents = fees.GrossAmountCents,
            Description = $"Payment for job: {job.Title}",
            IdempotencyKey = $"{ledgerIdempotencyBase}_received",
            RelatedEntityId = job.Id
        });

        db.LedgerEntries.Add(new LedgerEntry
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "platform_fee",
            Account = "platform_revenue",
            DebitCents = fees.PlatformFeeCents,
            Description = $"Platform commission ({fees.PlatformFeeCents}¢) on job {job.Id}",
            IdempotencyKey = $"{ledgerIdempotencyBase}_fee"
        });

        db.LedgerEntries.Add(new LedgerEntry
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "stripe_fee",
            Account = "stripe_fees",
            CreditCents = fees.StripeFeeEstimateCents,
            Description = $"Estimated Stripe processing fee",
            IdempotencyKey = $"{ledgerIdempotencyBase}_stripe"
        });

        db.LedgerEntries.Add(new LedgerEntry
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "vendor_earned",
            Account = "vendor_payable",
            DebitCents = fees.VendorNetCents,
            Description = $"Vendor payout for job: {job.Title}",
            IdempotencyKey = $"{ledgerIdempotencyBase}_vendor",
            RelatedEntityId = vendorProfile.Id
        });

        // Legacy ledger entry (kept for backward compat)
        db.PlatformFeeLedgerEntries.Add(new PlatformFeeLedger
        {
            PaymentTransactionId = transaction.Id,
            EntryType = "fee_earned",
            AmountCents = fees.PlatformFeeCents,
            Description = $"Platform fee for job {job.Id}"
        });

        // Create payout record
        var payout = new Payout
        {
            PaymentTransactionId = transaction.Id,
            VendorProfileId = vendorProfile.Id,
            AmountCents = fees.VendorNetCents,
            Status = PayoutStatus.Pending
        };
        db.Payouts.Add(payout);

        // Update job status
        job.Status = JobStatus.Paid;
        job.UpdatedAt = DateTime.UtcNow;
        job.Assignment!.ConfirmedAt = DateTime.UtcNow;

        job.AddDomainEvent(new PaymentCapturedEvent(transaction.Id, job.Id));

        await db.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(transaction.Id);
    }
}
