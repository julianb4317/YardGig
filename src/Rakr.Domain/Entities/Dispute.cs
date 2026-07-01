using Rakr.Domain.Common;
using Rakr.Domain.Enums;

namespace Rakr.Domain.Entities;

public class Dispute : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public Guid RaisedById { get; set; }
    public string DisputeNumber { get; set; } = string.Empty; // e.g., "DSP-20260701-A3F2"
    public string Summary { get; set; } = string.Empty; // Short title
    public string Reason { get; set; } = string.Empty; // Detailed description
    public List<string>? EvidencePhotos { get; set; } // Uploaded photo URLs
    public DisputeStatus Status { get; set; } = DisputeStatus.Open;
    public string? Resolution { get; set; }
    public Guid? ResolvedById { get; set; }
    public DateTime? ResolvedAt { get; set; }

    // Navigation
    public JobRequest JobRequest { get; set; } = null!;
    public ApplicationUser RaisedBy { get; set; } = null!;
    public ApplicationUser? ResolvedBy { get; set; }
    public ICollection<DisputeNote> Notes { get; set; } = [];
    public ICollection<DisputeMessage> Messages { get; set; } = [];
}
