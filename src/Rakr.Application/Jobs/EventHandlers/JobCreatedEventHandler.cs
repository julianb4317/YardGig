using MediatR;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Jobs.Dtos;
using Rakr.Domain.Events;

namespace Rakr.Application.Jobs.EventHandlers;

public class JobCreatedEventHandler(
    IAppDbContext db,
    IJobMapNotifier mapNotifier
) : INotificationHandler<JobCreatedEvent>
{
    public async Task Handle(JobCreatedEvent notification, CancellationToken cancellationToken)
    {
        var job = await db.JobRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == notification.JobRequestId, cancellationToken);

        if (job is null) return;

        var pin = new JobPinDto(
            job.Id,
            job.Title,
            job.Categories.ToArray(),
            job.BudgetCents,
            job.Location.Y,
            job.Location.X,
            job.ScheduleStart,
            job.ScheduleEnd,
            0
        );

        await mapNotifier.NotifyJobCreatedAsync(pin, cancellationToken);
    }
}
