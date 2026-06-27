using Microsoft.AspNetCore.SignalR;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Jobs.Dtos;
using Rakr.Infrastructure.Hubs;

namespace Rakr.Infrastructure.Services;

public class SignalRJobMapNotifier(IHubContext<JobMapHub> hubContext) : IJobMapNotifier
{
    public async Task NotifyJobCreatedAsync(JobPinDto pin, CancellationToken cancellationToken = default)
    {
        // Broadcast to all connected vendors. In production, use geohash-based groups.
        await hubContext.Clients.All.SendAsync("JobCreated", pin, cancellationToken);
    }

    public async Task NotifyJobRemovedAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        await hubContext.Clients.All.SendAsync("JobRemoved", jobId, cancellationToken);
    }
}
