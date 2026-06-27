using Rakr.Domain.Common;

namespace Rakr.Domain.Events;

public sealed class VendorRequestedEvent(Guid jobRequestId, Guid vendorProfileId) : DomainEvent
{
    public Guid JobRequestId { get; } = jobRequestId;
    public Guid VendorProfileId { get; } = vendorProfileId;
}
