namespace Rakr.Domain.Entities;

/// <summary>
/// Saved card reference for a customer (Stripe PaymentMethod).
/// Collected at registration via SetupIntent; used for one-click job payments.
/// </summary>
public class CustomerPaymentMethod
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerProfileId { get; set; }
    public string StripePaymentMethodId { get; set; } = string.Empty; // pm_xxx
    public string StripeCustomerId { get; set; } = string.Empty;       // cus_xxx
    public string CardLast4 { get; set; } = string.Empty;
    public string CardBrand { get; set; } = string.Empty;              // visa, mastercard, amex
    public int ExpMonth { get; set; }
    public int ExpYear { get; set; }
    public bool IsDefault { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public CustomerProfile CustomerProfile { get; set; } = null!;
}
