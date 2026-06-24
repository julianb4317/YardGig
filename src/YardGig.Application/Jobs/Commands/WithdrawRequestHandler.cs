using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Commands;

public class WithdrawRequestHandler(
    IAppDbContext db,
    ICurrentUserService currentUser,
    INotificationService notifications
) : IRequestHandler<WithdrawRequestCommand, Result>
{
    public async Task<Result> Handle(WithdrawRequestCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result.Failure("Unauthorized.");

        var vendorProfile = await db.VendorProfiles
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value, cancellationToken);

        if (vendorProfile is null)
            return Result.Failure("Vendor profile not found.");

        var vendorRequest = await db.VendorRequests
            .FirstOrDefaultAsync(vr => vr.JobRequestId == request.JobRequestId
                && vr.VendorProfileId == vendorProfile.Id,
                cancellationToken);

        if (vendorRequest is null)
            return Result.Failure("You have not requested this job.");

        if (vendorRequest.Status != VendorRequestStatus.Pending && vendorRequest.Status != VendorRequestStatus.Accepted)
            return Result.Failure("Cannot withdraw — request is already finalized.");

        var wasAccepted = vendorRequest.Status == VendorRequestStatus.Accepted;

        // Mark as withdrawn
        vendorRequest.Status = VendorRequestStatus.Withdrawn;
        vendorRequest.UpdatedAt = DateTime.UtcNow;

        // If this vendor was assigned, remove assignment and re-open job
        if (wasAccepted)
        {
            var assignment = await db.JobAssignments
                .FirstOrDefaultAsync(ja => ja.JobRequestId == request.JobRequestId
                    && ja.VendorProfileId == vendorProfile.Id, cancellationToken);

            if (assignment is not null)
            {
                db.JobAssignments.Remove(assignment);
            }

            var job = await db.JobRequests
                .Include(j => j.CustomerProfile)
                .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

            if (job is not null)
            {
                // Check if other pending requests exist
                var hasPendingRequests = await db.VendorRequests
                    .AnyAsync(vr => vr.JobRequestId == request.JobRequestId
                        && vr.Status == VendorRequestStatus.Pending, cancellationToken);

                job.Status = hasPendingRequests ? JobStatus.Requested : JobStatus.Open;
                job.UpdatedAt = DateTime.UtcNow;

                // Notify customer
                await notifications.SendInAppNotificationAsync(
                    job.CustomerProfile.UserId,
                    "vendor_withdrew",
                    "Vendor withdrew from your job",
                    $"The assigned vendor has withdrawn from \"{job.Title}\". The job has been re-opened.",
                    new { jobId = job.Id },
                    cancellationToken);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
