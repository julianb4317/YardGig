namespace Rakr.Domain.Entities;

/// <summary>
/// User-submitted abuse/fraud/safety report.
/// </summary>
public class AbuseReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReporterId { get; set; }
    public string EntityType { get; set; } = string.Empty; // User, JobRequest, Rating, VendorProfile
    public Guid EntityId { get; set; }
    public string Reason { get; set; } = string.Empty;     // fraud, spam, harassment, etc.
    public string? Description { get; set; }
    public string[]? EvidenceUrls { get; set; }
    public string Status { get; set; } = "open";           // open, investigating, resolved, dismissed
    public string? Resolution { get; set; }
    public Guid? ResolvedById { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser Reporter { get; set; } = null!;
    public ApplicationUser? ResolvedBy { get; set; }
}
