namespace Rakr.Domain.Entities;

public class AuditEntry
{
    public long Id { get; set; }
    public Guid? ActorId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string? OldValuesJson { get; set; }
    public string? NewValuesJson { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ApplicationUser? Actor { get; set; }
}
