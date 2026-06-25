using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

/// <summary>
/// Weekly batch payout from platform to vendor's bank account.
/// Covers accumulated VendorBalance, not a single job.
/// </summary>
public class Payout : BaseEntity
{
    public Guid VendorProfileId { get; set; }
    public string? StripeTransferId { get; set; }
    public int AmountCents { get; set; }
    public PayoutStatus Status { get; set; } = PayoutStatus.Pending;
    public string? FailureReason { get; set; }
    public DateTime? PaidAt { get; set; }
    public int RetryCount { get; set; }

    // Navigation
    public VendorProfile VendorProfile { get; set; } = null!;
}
