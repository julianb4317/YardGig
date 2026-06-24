using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

public class Payout : BaseEntity
{
    public Guid PaymentTransactionId { get; set; }
    public Guid VendorProfileId { get; set; }
    public string? StripeTransferId { get; set; }
    public int AmountCents { get; set; }
    public PayoutStatus Status { get; set; } = PayoutStatus.Pending;
    public DateTime? PaidAt { get; set; }

    // Navigation
    public PaymentTransaction PaymentTransaction { get; set; } = null!;
    public VendorProfile VendorProfile { get; set; } = null!;
}
