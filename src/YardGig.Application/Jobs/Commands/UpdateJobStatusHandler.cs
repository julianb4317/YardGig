using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Enums;
using YardGig.Domain.Events;

namespace YardGig.Application.Jobs.Commands;

public class UpdateJobStatusHandler(
    IAppDbContext db,
    ICurrentUserService currentUser
) : IRequestHandler<UpdateJobStatusCommand, Result>
{
    private static readonly Dictionary<JobStatus, JobStatus[]> AllowedTransitions = new()
    {
        [JobStatus.Open] = [JobStatus.Cancelled],
        [JobStatus.Requested] = [JobStatus.Cancelled],
        [JobStatus.Assigned] = [JobStatus.InProgress, JobStatus.Cancelled],
        [JobStatus.InProgress] = [JobStatus.Completed],
        [JobStatus.Completed] = [JobStatus.Paid, JobStatus.Disputed],
        [JobStatus.Paid] = [JobStatus.Closed],
    };

    public async Task<Result> Handle(UpdateJobStatusCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result.Failure("Unauthorized.");

        var job = await db.JobRequests
            .Include(j => j.Assignment)
            .Include(j => j.CustomerProfile)
            .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

        if (job is null)
            return Result.Failure("Job not found.");

        if (!AllowedTransitions.TryGetValue(job.Status, out var allowed) || !allowed.Contains(request.NewStatus))
            return Result.Failure($"Cannot transition from {job.Status} to {request.NewStatus}.");

        job.Status = request.NewStatus;
        job.UpdatedAt = DateTime.UtcNow;

        // Update assignment timestamps
        if (job.Assignment is not null)
        {
            switch (request.NewStatus)
            {
                case JobStatus.InProgress:
                    job.Assignment.StartedAt = DateTime.UtcNow;
                    break;
                case JobStatus.Completed:
                    job.Assignment.CompletedAt = DateTime.UtcNow;
                    job.AddDomainEvent(new JobCompletedEvent(job.Id));
                    break;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
