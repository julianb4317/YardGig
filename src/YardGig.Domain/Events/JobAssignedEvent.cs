using YardGig.Domain.Common;

namespace YardGig.Domain.Events;

public sealed class JobAssignedEvent(Guid jobRequestId, Guid vendorProfileId) : DomainEvent
{
    public Guid JobRequestId { get; } = jobRequestId;
    public Guid VendorProfileId { get; } = vendorProfileId;
}
