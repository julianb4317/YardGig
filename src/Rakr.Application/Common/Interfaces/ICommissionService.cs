namespace Rakr.Application.Common.Interfaces;

public interface ICommissionService
{
    /// <summary>
    /// Resolves the effective commission rate for a given vendor and job categories.
    /// Priority: Vendor-specific > Category > Global default.
    /// </summary>
    Task<decimal> GetEffectiveRateAsync(Guid vendorProfileId, string[] categories, CancellationToken ct = default);

    /// <summary>
    /// Calculates the customer-facing fee breakdown.
    /// Customer pays: Budget + Trust & Escrow Fee (10%) + Payment Processing (2.9% + $0.30).
    /// Vendor receives: Full budget amount.
    /// </summary>
    Task<FeeBreakdown> CalculateFeesAsync(int budgetCents, Guid vendorProfileId, string[] categories, CancellationToken ct = default);
}

public record FeeBreakdown(
    int BudgetCents,          // What the vendor gets (the job budget)
    int TrustFeeCents,        // 10% of budget — platform revenue
    int ProcessingFeeCents,   // 2.9% + $0.30 of total transaction
    int TotalChargeCents,     // What the customer pays (budget + fees)
    int PlatformRevenueCents  // Trust fee (processing fee goes to Stripe)
);
