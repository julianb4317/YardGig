using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

/// <summary>
/// Tracks funds held in escrow for a job.
/// Created when job is posted (auth hold placed on customer card).
/// Captured when vendor is assigned.
/// Released to vendor when customer verifies completion.
/// </summary>
public class EscrowTransaction : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public Guid CustomerProfileId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public int AmountCents { get; set; }           // Total charged/held (budget + fees)
    public int BudgetCents { get; set; }           // Job budget (what vendor receives)
    public int TrustFeeCents { get; set; }         // 10% trust & escrow fee (platform revenue)
    public int ProcessingFeeCents { get; set; }    // 2.9% + $0.30 (goes to Stripe)
    public int PlatformFeeCents { get; set; }      // = TrustFeeCents (kept for backwards compat)
    public int VendorAmountCents { get; set; }     // = BudgetCents (vendor gets full budget)
    public string Currency { get; set; } = "usd";
    public EscrowStatus Status { get; set; } = EscrowStatus.Authorized;
    public DateTime? CapturedAt { get; set; }
    public DateTime? ReleasedAt { get; set; }
    public DateTime? RefundedAt { get; set; }

    public JobRequest JobRequest { get; set; } = null!;
    public CustomerProfile CustomerProfile { get; set; } = null!;
}

public enum EscrowStatus
{
    Authorized, // Auth hold placed, not yet captured
    Held,       // Funds captured and held (vendor assigned)
    Released,   // Released to vendor on verification
    Refunded    // Authorization released / refunded to customer
}
