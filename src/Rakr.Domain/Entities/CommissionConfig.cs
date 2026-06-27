namespace Rakr.Domain.Entities;

/// <summary>
/// Configurable commission rates at global, category, or vendor level.
/// Resolution priority: Vendor-specific > Category > Global.
/// </summary>
public class CommissionConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Scope { get; set; } = "global"; // global, category, vendor
    public string? ScopeKey { get; set; }          // category name or vendor profile ID
    public decimal Rate { get; set; }              // 0.15 = 15%
    public DateTime EffectiveFrom { get; set; } = DateTime.UtcNow;
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
