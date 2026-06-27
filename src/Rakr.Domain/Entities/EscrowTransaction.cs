using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

/// <summary>
/// Tracks funds held in escrow for a job.
/// Created when job is posted (customer charged).
/// Released when customer verifies completion.
/// </summary>
public class EscrowTransaction : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public Guid CustomerProfileId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public int AmountCents { get; set; }           // Total charged to customer
    public int PlatformFeeCents { get; set; }      // Platform keeps on release
    public int VendorAmountCents { get; set; }     // Vendor gets on release
    public string Currency { get; set; } = "usd";
    public EscrowStatus Status { get; set; } = EscrowStatus.Held;
    public DateTime? ReleasedAt { get; set; }
    public DateTime? RefundedAt { get; set; }

    public JobRequest JobRequest { get; set; } = null!;
    public CustomerProfile CustomerProfile { get; set; } = null!;
}

public enum EscrowStatus
{
    Held,       // Funds charged and held
    Released,   // Released to vendor on verification
    Refunded    // Returned to customer (cancellation/dispute)
}
