using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

public class PlatformFeeLedger : BaseEntity
{
    public Guid PaymentTransactionId { get; set; }
    public string EntryType { get; set; } = string.Empty; // fee_earned, refund_debit
    public int AmountCents { get; set; }
    public string? Description { get; set; }

    // Navigation
    public PaymentTransaction PaymentTransaction { get; set; } = null!;
}
