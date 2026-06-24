using YardGig.Application.Jobs.Dtos;

namespace YardGig.Application.Common.Interfaces;

/// <summary>
/// Abstraction for pushing real-time map updates to connected vendors.
/// </summary>
public interface IJobMapNotifier
{
    Task NotifyJobCreatedAsync(JobPinDto pin, CancellationToken cancellationToken = default);
    Task NotifyJobRemovedAsync(Guid jobId, CancellationToken cancellationToken = default);
}
