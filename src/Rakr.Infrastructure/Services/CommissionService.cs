using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Infrastructure.Persistence;

namespace Rakr.Infrastructure.Services;

public class CommissionService(AppDbContext db) : ICommissionService
{
    private const decimal DefaultRate = 0.15m;
    private const decimal StripePercentage = 0.029m;
    private const int StripeFixedFeeCents = 30;

    public async Task<decimal> GetEffectiveRateAsync(Guid vendorProfileId, string[] categories, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // 1. Check vendor-specific override
        var vendorRate = await db.CommissionConfigs
            .Where(c => c.Scope == "vendor"
                && c.ScopeKey == vendorProfileId.ToString()
                && c.IsActive
                && c.EffectiveFrom <= now
                && (c.EffectiveTo == null || c.EffectiveTo > now))
            .Select(c => (decimal?)c.Rate)
            .FirstOrDefaultAsync(ct);

        if (vendorRate.HasValue)
            return vendorRate.Value;

        // 2. Check category override (use lowest rate if multiple categories)
        if (categories.Length > 0)
        {
            var categoryRates = await db.CommissionConfigs
                .Where(c => c.Scope == "category"
                    && categories.Contains(c.ScopeKey!)
                    && c.IsActive
                    && c.EffectiveFrom <= now
                    && (c.EffectiveTo == null || c.EffectiveTo > now))
                .Select(c => c.Rate)
                .ToListAsync(ct);

            if (categoryRates.Count > 0)
                return categoryRates.Min(); // Favor the vendor with lowest applicable rate
        }

        // 3. Global default
        var globalRate = await db.CommissionConfigs
            .Where(c => c.Scope == "global"
                && c.IsActive
                && c.EffectiveFrom <= now
                && (c.EffectiveTo == null || c.EffectiveTo > now))
            .Select(c => (decimal?)c.Rate)
            .FirstOrDefaultAsync(ct);

        return globalRate ?? DefaultRate;
    }

    public async Task<FeeBreakdown> CalculateFeesAsync(int grossAmountCents, Guid vendorProfileId, string[] categories, CancellationToken ct = default)
    {
        var rate = await GetEffectiveRateAsync(vendorProfileId, categories, ct);

        var platformFeeCents = (int)Math.Ceiling(grossAmountCents * rate);
        var stripeFeeEstimate = (int)Math.Ceiling(grossAmountCents * StripePercentage) + StripeFixedFeeCents;
        var vendorNetCents = grossAmountCents - platformFeeCents;

        return new FeeBreakdown(grossAmountCents, platformFeeCents, stripeFeeEstimate, vendorNetCents);
    }
}
