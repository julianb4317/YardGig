using YardGig.Domain.Common;

namespace YardGig.Domain.Events;

public sealed class JobCompletedEvent(Guid jobRequestId) : DomainEvent
{
    public Guid JobRequestId { get; } = jobRequestId;
}
