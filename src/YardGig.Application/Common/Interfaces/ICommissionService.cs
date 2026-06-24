namespace YardGig.Application.Common.Interfaces;

public interface ICommissionService
{
    /// <summary>
    /// Resolves the effective commission rate for a given vendor and job categories.
    /// Priority: Vendor-specific > Category > Global default.
    /// </summary>
    Task<decimal> GetEffectiveRateAsync(Guid vendorProfileId, string[] categories, CancellationToken ct = default);

    /// <summary>
    /// Calculates fee breakdown for a given gross amount.
    /// </summary>
    Task<FeeBreakdown> CalculateFeesAsync(int grossAmountCents, Guid vendorProfileId, string[] categories, CancellationToken ct = default);
}

public record FeeBreakdown(
    int GrossAmountCents,
    int PlatformFeeCents,
    int StripeFeeEstimateCents,
    int VendorNetCents
);
