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

        if (job.CustomerProfile.UserId != currentUser.UserId.Value)
            return Result.Failure("Only the job owner can assign vendors.");

        if (job.Status != JobStatus.Requested && job.Status != JobStatus.Open)
            return Result.Failure("Job is not in a state that allows assignment.");

        var vendorReq = await db.VendorRequests
            .FirstOrDefaultAsync(vr => vr.Id == request.VendorRequestId && vr.JobRequestId == request.JobRequestId, cancellationToken);

        if (vendorReq is null)
            return Result.Failure("Vendor request not found.");

        // Accept this vendor
        vendorReq.Status = VendorRequestStatus.Accepted;
        vendorReq.UpdatedAt = DateTime.UtcNow;

        // Reject other vendors
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
        job.AddDomainEvent(new JobAssignedEvent(job.Id, vendorReq.VendorProfileId));

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
