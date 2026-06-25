using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Entities;
using YardGig.Domain.Enums;
using YardGig.Domain.Events;

namespace YardGig.Application.Jobs.Commands;

public class AssignVendorHandler(
    IAppDbContext db,
    ICurrentUserService currentUser
) : IRequestHandler<AssignVendorCommand, Result>
{
    public async Task<Result> Handle(AssignVendorCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result.Failure("Unauthorized.");

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

        if (job is null)
            return Result.Failure("Job not found.");

        // Ownership check: verify the current user owns this job
        if (job.CustomerProfile == null)
        {
            // Try to find customer profile by user ID directly
            var profile = await db.CustomerProfiles
                .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value, cancellationToken);
            if (profile == null || profile.Id != job.CustomerProfileId)
                return Result.Failure("Only the job owner can assign vendors.");
        }
        else if (job.CustomerProfile.UserId != currentUser.UserId.Value)
        {
            return Result.Failure("Only the job owner can assign vendors.");
        }

        if (job.Status != JobStatus.Requested && job.Status != JobStatus.Open)
            return Result.Failure("Job is not in a state that allows assignment.");

        var vendorReq = await db.VendorRequests
            .FirstOrDefaultAsync(vr => vr.Id == request.VendorRequestId && vr.JobRequestId == request.JobRequestId, cancellationToken);

        if (vendorReq is null)
            return Result.Failure("Vendor request not found.");

        if (vendorReq.Status != VendorRequestStatus.Pending)
            return Result.Failure($"This vendor request is not pending (current status: {vendorReq.Status}).");

        // Accept this vendor
        vendorReq.Status = VendorRequestStatus.Accepted;
        vendorReq.UpdatedAt = DateTime.UtcNow;

        // Reject other pending vendors
        var otherRequests = await db.VendorRequests
            .Where(vr => vr.JobRequestId == request.JobRequestId && vr.Id != request.VendorRequestId && vr.Status == VendorRequestStatus.Pending)
            .ToListAsync(cancellationToken);

        foreach (var other in otherRequests)
        {
            other.Status = VendorRequestStatus.Rejected;
            other.UpdatedAt = DateTime.UtcNow;
        }

        // Create assignment
        var assignment = new JobAssignment
        {
            JobRequestId = job.Id,
            VendorProfileId = vendorReq.VendorProfileId,
            VendorRequestId = vendorReq.Id,
            AssignedAt = DateTime.UtcNow
        };
        db.JobAssignments.Add(assignment);

        // Update job status
        job.Status = JobStatus.Assigned;
        job.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
