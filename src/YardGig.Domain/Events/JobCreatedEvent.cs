using YardGig.Domain.Common;

namespace YardGig.Domain.Events;

public sealed class JobCreatedEvent(Guid jobRequestId) : DomainEvent
{
    public Guid JobRequestId { get; } = jobRequestId;
}
