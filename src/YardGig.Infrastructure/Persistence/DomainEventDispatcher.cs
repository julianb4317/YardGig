using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Domain.Common;

namespace YardGig.Infrastructure.Persistence;

/// <summary>
/// Dispatches domain events after SaveChanges succeeds.
/// </summary>
public static class DomainEventDispatcher
{
    public static async Task DispatchDomainEventsAsync(this DbContext context, IMediator mediator)
    {
        var entities = context.ChangeTracker
            .Entries<AggregateRoot>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .Select(e => e.Entity)
            .ToList();

        var domainEvents = entities
            .SelectMany(e => e.DomainEvents)
            .ToList();

        entities.ForEach(e => e.ClearDomainEvents());

        foreach (var domainEvent in domainEvents)
        {
            await mediator.Publish(domainEvent);
        }
    }
}
