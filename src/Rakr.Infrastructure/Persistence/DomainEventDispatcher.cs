using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Rakr.Domain.Common;

namespace Rakr.Infrastructure.Persistence;

/// <summary>
/// Dispatches domain events after SaveChanges succeeds.
/// Failures in event handlers do not roll back the save.
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
            try
            {
                await mediator.Publish(domainEvent);
            }
            catch (Exception)
            {
                // Domain event handlers should not crash the save operation.
                // The primary write succeeded; event processing is best-effort.
                // In production, failed events would go to a retry queue.
            }
        }
    }
}
