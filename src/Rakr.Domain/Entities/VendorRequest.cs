using Rakr.Domain.Common;
using Rakr.Domain.Enums;

namespace Rakr.Domain.Entities;

public class VendorRequest : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public Guid VendorProfileId { get; set; }
    public VendorRequestStatus Status { get; set; } = VendorRequestStatus.Pending;
    public int? ProposedPriceCents { get; set; }
    public string? Note { get; set; }

    // Navigation
    public JobRequest JobRequest { get; set; } = null!;
    public VendorProfile VendorProfile { get; set; } = null!;
}
