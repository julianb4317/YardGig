using YardGig.Domain.Common;

namespace YardGig.Domain.Entities;

public class JobAssignment : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public Guid VendorProfileId { get; set; }
    public Guid VendorRequestId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }

    // Navigation
    public JobRequest JobRequest { get; set; } = null!;
    public VendorProfile VendorProfile { get; set; } = null!;
    public VendorRequest VendorRequest { get; set; } = null!;
}
