using MediatR;

namespace YardGig.Domain.Common;

public interface IDomainEvent : INotification
{
    DateTime OccurredAt { get; }
}

public abstract class DomainEvent : IDomainEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}
