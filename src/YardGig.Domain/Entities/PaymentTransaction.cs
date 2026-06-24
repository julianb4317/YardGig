using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

public class PaymentTransaction : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public int AmountCents { get; set; }
    public int PlatformFeeCents { get; set; }
    public int VendorPayoutCents { get; set; }
    public string Currency { get; set; } = "usd";
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public DateTime? CapturedAt { get; set; }

    // Navigation
    public JobRequest JobRequest { get; set; } = null!;
    public Payout? Payout { get; set; }
    public PlatformFeeLedger? FeeLedgerEntry { get; set; }
}
