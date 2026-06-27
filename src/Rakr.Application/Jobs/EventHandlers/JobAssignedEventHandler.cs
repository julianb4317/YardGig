using MediatR;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Events;

namespace Rakr.Application.Jobs.EventHandlers;

public class JobAssignedEventHandler(IJobMapNotifier mapNotifier) : INotificationHandler<JobAssignedEvent>
{
    public async Task Handle(JobAssignedEvent notification, CancellationToken cancellationToken)
    {
        // Remove pin from map since job is no longer open
        await mapNotifier.NotifyJobRemovedAsync(notification.JobRequestId, cancellationToken);
    }
}
