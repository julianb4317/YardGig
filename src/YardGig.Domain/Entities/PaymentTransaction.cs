using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

/// <summary>
/// Record of a customer payment for a job.
/// Money flows: Customer card → Platform Stripe balance.
/// Vendor balance is credited but transfer happens weekly.
/// </summary>
public class PaymentTransaction : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public string? StripeCustomerId { get; set; }
    public int AmountCents { get; set; }             // What customer paid
    public int PlatformFeeCents { get; set; }        // Platform keeps
    public int VendorEarnedCents { get; set; }       // Added to vendor balance
    public string Currency { get; set; } = "usd";
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public DateTime? CapturedAt { get; set; }

    // Navigation
    public JobRequest JobRequest { get; set; } = null!;
    public Payout? Payout { get; set; }
    public PlatformFeeLedger? FeeLedgerEntry { get; set; }
}
