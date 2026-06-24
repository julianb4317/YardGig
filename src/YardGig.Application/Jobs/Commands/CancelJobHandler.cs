using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Commands;

public class CancelJobHandler(
    IAppDbContext db,
    ICurrentUserService currentUser,
    INotificationService notifications
) : IRequestHandler<CancelJobCommand, Result<CancelJobResult>>
{
    private const int LateCancelPenaltyCents = 500; // $5
    private static readonly TimeSpan LateCancelThreshold = TimeSpan.FromHours(2);

    private static readonly JobStatus[] CancellableStatuses =
        [JobStatus.Draft, JobStatus.Open, JobStatus.Requested, JobStatus.Assigned];

    public async Task<Result<CancelJobResult>> Handle(CancelJobCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<CancelJobResult>.Failure("Unauthorized.");

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .Include(j => j.Assignment)
                .ThenInclude(a => a!.VendorProfile)
                    .ThenInclude(vp => vp.User)
            .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

        if (job is null)
            return Result<CancelJobResult>.Failure("Job not found.");

        if (job.CustomerProfile.UserId != currentUser.UserId.Value)
            return Result<CancelJobResult>.Failure("Only the job owner can cancel.");

        if (!CancellableStatuses.Contains(job.Status))
            return Result<CancelJobResult>.Failure("Cannot cancel a job that is in progress. Please raise a dispute.");

        var penaltyApplied = false;
        var penaltyCents = 0;

        // Check late cancellation for assigned jobs
        if (job.Status == JobStatus.Assigned && job.ScheduleStart.HasValue)
        {
            var timeUntilStart = job.ScheduleStart.Value - DateTime.UtcNow;
            if (timeUntilStart < LateCancelThreshold)
            {
                penaltyApplied = true;
                penaltyCents = LateCancelPenaltyCents;
            }
        }

        // Reject all pending vendor requests
        var pendingRequests = await db.VendorRequests
            .Include(vr => vr.VendorProfile)
                .ThenInclude(vp => vp.User)
            .Where(vr => vr.JobRequestId == request.JobRequestId && vr.Status == VendorRequestStatus.Pending)
            .ToListAsync(cancellationToken);

        foreach (var vr in pendingRequests)
        {
            vr.Status = VendorRequestStatus.Rejected;
            vr.UpdatedAt = DateTime.UtcNow;

            await notifications.SendInAppNotificationAsync(
                vr.VendorProfile.UserId,
                "job_cancelled",
                "Job cancelled by customer",
                $"The job \"{job.Title}\" has been cancelled.",
                new { jobId = job.Id },
                cancellationToken);
        }

        // Notify assigned vendor
        if (job.Assignment is not null)
        {
            var vendorUserId = job.Assignment.VendorProfile.UserId;
            await notifications.SendInAppNotificationAsync(
                vendorUserId,
                "assignment_cancelled",
                penaltyApplied ? "Job cancelled (late - compensation applied)" : "Job cancelled by customer",
                $"The job \"{job.Title}\" has been cancelled by the customer.",
                new { jobId = job.Id, penaltyApplied, penaltyCents },
                cancellationToken);

            // Remove assignment
            db.JobAssignments.Remove(job.Assignment);
        }

        // Update job status
        job.Status = JobStatus.Cancelled;
        job.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result<CancelJobResult>.Success(new CancelJobResult(penaltyApplied, penaltyCents));
    }
}
