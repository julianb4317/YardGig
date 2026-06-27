using MediatR;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Common.Models;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;
using Rakr.Domain.Events;

namespace Rakr.Application.Jobs.Commands;

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
            // Only add domain user if not already present
            var domainUserExists = await db.Users.AnyAsync(u => u.Id == currentUser.UserId.Value, cancellationToken);
            if (!domainUserExists)
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
            vendorProfile.VerificationStatus = VerificationStatus.Approved;
            await db.SaveChangesAsync(cancellationToken);
        }

        var job = await db.JobRequests.FindAsync([request.JobRequestId], cancellationToken);
        if (job is null)
            return Result<Guid>.Failure("Job not found.");

        // Auto-expire if end date passed
        if (job.ScheduleEnd.HasValue && job.ScheduleEnd.Value < DateTime.UtcNow
            && (job.Status == JobStatus.Open || job.Status == JobStatus.Requested))
        {
            job.Status = JobStatus.Expired;
            await db.SaveChangesAsync(cancellationToken);
            return Result<Guid>.Failure("This job has expired.");
        }

        if (job.Status != JobStatus.Open && job.Status != JobStatus.Requested)
            return Result<Guid>.Failure("Job is no longer open for requests.");

        // Check if already requested (excluding withdrawn — allow re-request after withdraw)
        var existingRequest = await db.VendorRequests
            .FirstOrDefaultAsync(vr => vr.JobRequestId == request.JobRequestId && vr.VendorProfileId == vendorProfile.Id, cancellationToken);

        if (existingRequest is not null)
        {
            if (existingRequest.Status == VendorRequestStatus.Withdrawn || existingRequest.Status == VendorRequestStatus.Rejected)
            {
                // Re-activate the request (vendor is trying again)
                existingRequest.Status = VendorRequestStatus.Pending;
                existingRequest.ProposedPriceCents = request.ProposedPriceCents;
                existingRequest.Note = request.Note;
                existingRequest.UpdatedAt = DateTime.UtcNow;

                if (job.Status == JobStatus.Open)
                {
                    job.Status = JobStatus.Requested;
                    job.UpdatedAt = DateTime.UtcNow;
                }

                await db.SaveChangesAsync(cancellationToken);
                return Result<Guid>.Success(existingRequest.Id);
            }
            if (existingRequest.Status == VendorRequestStatus.Pending)
                return Result<Guid>.Failure("You have already requested this job.");
            if (existingRequest.Status == VendorRequestStatus.Accepted)
                return Result<Guid>.Failure("You are already assigned to this job.");
        }

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
