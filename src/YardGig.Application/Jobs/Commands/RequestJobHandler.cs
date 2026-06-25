using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Entities;
using YardGig.Domain.Enums;
using YardGig.Domain.Events;

namespace YardGig.Application.Jobs.Commands;

public class RequestJobHandler(
    IAppDbContext db,
    ICurrentUserService currentUser
) : IRequestHandler<RequestJobCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(RequestJobCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<Guid>.Failure("Unauthorized.");

        var vendorProfile = await db.VendorProfiles
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value, cancellationToken);

        // Auto-create vendor profile if missing
        if (vendorProfile is null)
        {
            var domainUser = await db.Users.FindAsync([currentUser.UserId.Value], cancellationToken);
            if (domainUser is null)
            {
                db.Users.Add(new Domain.Entities.ApplicationUser
                {
                    Id = currentUser.UserId.Value,
                    Email = currentUser.Email ?? "",
                    DisplayName = currentUser.Email ?? "User",
                    EmailVerified = true, AuthProvider = "local", IsActive = true
                });
            }
            vendorProfile = new Domain.Entities.VendorProfile
            {
                UserId = currentUser.UserId.Value,
                VerificationStatus = VerificationStatus.Approved
            };
            db.VendorProfiles.Add(vendorProfile);
            await db.SaveChangesAsync(cancellationToken);
        }
        else if (vendorProfile.VerificationStatus != VerificationStatus.Approved)
        {
            // Auto-approve for development
            vendorProfile.VerificationStatus = VerificationStatus.Approved;
            await db.SaveChangesAsync(cancellationToken);
        }

        var job = await db.JobRequests.FindAsync([request.JobRequestId], cancellationToken);
        if (job is null)
            return Result<Guid>.Failure("Job not found.");

        if (job.Status != JobStatus.Open && job.Status != JobStatus.Requested)
            return Result<Guid>.Failure("Job is no longer open for requests.");

        var alreadyRequested = await db.VendorRequests
            .AnyAsync(vr => vr.JobRequestId == request.JobRequestId && vr.VendorProfileId == vendorProfile.Id, cancellationToken);

        if (alreadyRequested)
            return Result<Guid>.Failure("You have already requested this job.");

        var vendorRequest = new VendorRequest
        {
            JobRequestId = request.JobRequestId,
            VendorProfileId = vendorProfile.Id,
            ProposedPriceCents = request.ProposedPriceCents,
            Note = request.Note,
            Status = VendorRequestStatus.Pending
        };

        db.VendorRequests.Add(vendorRequest);

        // Update job status to indicate it has requests
        if (job.Status == JobStatus.Open)
        {
            job.Status = JobStatus.Requested;
            job.UpdatedAt = DateTime.UtcNow;
        }

        job.AddDomainEvent(new VendorRequestedEvent(job.Id, vendorProfile.Id));
        await db.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(vendorRequest.Id);
    }
}
