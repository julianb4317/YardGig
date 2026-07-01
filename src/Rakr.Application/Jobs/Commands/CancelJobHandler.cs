using MediatR;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Common.Models;
using Rakr.Domain.Enums;

namespace Rakr.Application.Jobs.Commands;

public class CancelJobHandler(
    IAppDbContext db,
    ICurrentUserService currentUser,
    IPaymentService paymentService
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
            .Where(vr => vr.JobRequestId == request.JobRequestId && vr.Status == VendorRequestStatus.Pending)
            .ToListAsync(cancellationToken);

        foreach (var vr in pendingRequests)
        {
            vr.Status = VendorRequestStatus.Rejected;
            vr.UpdatedAt = DateTime.UtcNow;
        }

        // Remove assignment if exists
        if (job.Assignment is not null)
        {
            db.JobAssignments.Remove(job.Assignment);
        }

        // Update job status
        job.Status = JobStatus.Cancelled;
        job.UpdatedAt = DateTime.UtcNow;

        // Release any authorization hold (no charge if auth hasn't been captured)
        var escrow = await db.EscrowTransactions
            .FirstOrDefaultAsync(e => e.JobRequestId == job.Id
                && (e.Status == Rakr.Domain.Entities.EscrowStatus.Authorized
                    || e.Status == Rakr.Domain.Entities.EscrowStatus.Held), cancellationToken);

        if (escrow is not null && !string.IsNullOrEmpty(escrow.StripePaymentIntentId))
        {
            if (escrow.Status == Rakr.Domain.Entities.EscrowStatus.Authorized)
            {
                // Auth hold — release without charging ($0 cost)
                await paymentService.ReleaseAuthorizationAsync(escrow.StripePaymentIntentId, cancellationToken);
            }
            // If already captured (Held), would need a refund — but we still release for now
            escrow.Status = Rakr.Domain.Entities.EscrowStatus.Refunded;
            escrow.RefundedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result<CancelJobResult>.Success(new CancelJobResult(penaltyApplied, penaltyCents));
    }
}
