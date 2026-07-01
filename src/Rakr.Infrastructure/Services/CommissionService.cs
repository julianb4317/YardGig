using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Infrastructure.Persistence;

namespace Rakr.Infrastructure.Services;

public class CommissionService(AppDbContext db) : ICommissionService
{
    private const decimal DefaultTrustFeeRate = 0.10m; // 10% trust & escrow fee
    private const decimal StripePercentage = 0.029m;   // 2.9%
    private const int StripeFixedFeeCents = 30;        // + $0.30

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
                return categoryRates.Min();
        }

        // 3. Global default
        var globalRate = await db.CommissionConfigs
            .Where(c => c.Scope == "global"
                && c.IsActive
                && c.EffectiveFrom <= now
                && (c.EffectiveTo == null || c.EffectiveTo > now))
            .Select(c => (decimal?)c.Rate)
            .FirstOrDefaultAsync(ct);

        return globalRate ?? DefaultTrustFeeRate;
    }

    public async Task<FeeBreakdown> CalculateFeesAsync(int budgetCents, Guid vendorProfileId, string[] categories, CancellationToken ct = default)
    {
        var trustRate = await GetEffectiveRateAsync(vendorProfileId, categories, ct);

        // Trust & Escrow Fee: percentage of budget (platform revenue)
        var trustFeeCents = (int)Math.Ceiling(budgetCents * trustRate);

        // Subtotal before processing fee
        var subtotalCents = budgetCents + trustFeeCents;

        // Payment Processing Fee: 2.9% + $0.30 of the total transaction
        var processingFeeCents = (int)Math.Ceiling(subtotalCents * StripePercentage) + StripeFixedFeeCents;

        // Total the customer pays
        var totalChargeCents = subtotalCents + processingFeeCents;

        return new FeeBreakdown(
            BudgetCents: budgetCents,
            TrustFeeCents: trustFeeCents,
            ProcessingFeeCents: processingFeeCents,
            TotalChargeCents: totalChargeCents,
            PlatformRevenueCents: trustFeeCents // Platform keeps the trust fee; processing fee goes to Stripe
        );
    }
}
