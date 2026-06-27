using Rakr.Domain.Common;

namespace Rakr.Domain.Events;

public sealed class JobCreatedEvent(Guid jobRequestId) : DomainEvent
{
    public Guid JobRequestId { get; } = jobRequestId;
}
