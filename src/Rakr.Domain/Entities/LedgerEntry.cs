namespace Rakr.Domain.Entities;

/// <summary>
/// Append-only financial ledger entry.
/// Every payment event creates one or more entries.
/// Never updated or deleted — corrections use compensating entries.
/// </summary>
public class LedgerEntry
{
    public long Id { get; set; }
    public Guid PaymentTransactionId { get; set; }
    public string EntryType { get; set; } = string.Empty;
    public string Account { get; set; } = string.Empty;
    public int DebitCents { get; set; }
    public int CreditCents { get; set; }
    public string Currency { get; set; } = "usd";
    public string? Description { get; set; }
    public string? IdempotencyKey { get; set; }
    public Guid? RelatedEntityId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public PaymentTransaction PaymentTransaction { get; set; } = null!;
}
