using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Commands;

public class RescheduleJobHandler(
    IAppDbContext db,
    ICurrentUserService currentUser,
    INotificationService notifications
) : IRequestHandler<RescheduleJobCommand, Result>
{
    private static readonly JobStatus[] ReschedulableStatuses =
        [JobStatus.Open, JobStatus.Requested, JobStatus.Assigned];

    public async Task<Result> Handle(RescheduleJobCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result.Failure("Unauthorized.");

        if (request.ScheduleStart <= DateTime.UtcNow.AddHours(1))
            return Result.Failure("New schedule must be at least 1 hour from now.");

        if (request.ScheduleEnd <= request.ScheduleStart)
            return Result.Failure("End time must be after start time.");

        if ((request.ScheduleEnd - request.ScheduleStart).TotalDays > 7)
            return Result.Failure("Schedule window cannot exceed 7 days.");

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .Include(j => j.Assignment)
                .ThenInclude(a => a!.VendorProfile)
            .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

        if (job is null)
            return Result.Failure("Job not found.");

        if (job.CustomerProfile.UserId != currentUser.UserId.Value)
            return Result.Failure("Only the job owner can reschedule.");

        if (!ReschedulableStatuses.Contains(job.Status))
            return Result.Failure($"Cannot reschedule a job in {job.Status} status.");

        // Update schedule
        job.ScheduleStart = request.ScheduleStart;
        job.ScheduleEnd = request.ScheduleEnd;
        job.UpdatedAt = DateTime.UtcNow;

        // Notify assigned vendor if applicable
        if (job.Status == JobStatus.Assigned && job.Assignment is not null)
        {
            await notifications.SendInAppNotificationAsync(
                job.Assignment.VendorProfile.UserId,
                "job_rescheduled",
                "Job schedule changed",
                $"The schedule for \"{job.Title}\" has been updated. You can withdraw if the new time doesn't work.",
                new { jobId = job.Id, scheduleStart = request.ScheduleStart, scheduleEnd = request.ScheduleEnd },
                cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
