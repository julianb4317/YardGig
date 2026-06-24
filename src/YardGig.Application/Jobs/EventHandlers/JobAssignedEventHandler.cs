using MediatR;
using YardGig.Application.Common.Interfaces;
using YardGig.Domain.Events;

namespace YardGig.Application.Jobs.EventHandlers;

public class JobAssignedEventHandler(IJobMapNotifier mapNotifier) : INotificationHandler<JobAssignedEvent>
{
    public async Task Handle(JobAssignedEvent notification, CancellationToken cancellationToken)
    {
        // Remove pin from map since job is no longer open
        await mapNotifier.NotifyJobRemovedAsync(notification.JobRequestId, cancellationToken);
    }
}
