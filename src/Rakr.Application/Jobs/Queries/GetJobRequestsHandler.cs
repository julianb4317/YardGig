using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Common.Models;
using Rakr.Domain.Enums;

namespace Rakr.Application.Jobs.Queries;

public class GetJobRequestsHandler(
    IAppDbContext db,
    ICurrentUserService currentUser
) : IRequestHandler<GetJobRequestsQuery, Result<List<VendorRequestDto>>>
{
    public async Task<Result<List<VendorRequestDto>>> Handle(GetJobRequestsQuery request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<List<VendorRequestDto>>.Failure("Unauthorized.");

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

        if (job is null)
            return Result<List<VendorRequestDto>>.Failure("Job not found.");

        if (job.CustomerProfile.UserId != currentUser.UserId.Value)
            return Result<List<VendorRequestDto>>.Failure("Only the job owner can view requests.");

        var vendorRequests = await db.VendorRequests
            .AsNoTracking()
            .Include(vr => vr.VendorProfile)
                .ThenInclude(vp => vp.User)
            .Where(vr => vr.JobRequestId == request.JobRequestId)
            .OrderByDescending(vr => vr.CreatedAt)
            .Select(vr => new VendorRequestDto(
                vr.Id,
                vr.VendorProfileId,
                vr.VendorProfile.User.DisplayName,
                vr.VendorProfile.BusinessName,
                vr.VendorProfile.AverageRating,
                vr.VendorProfile.TotalJobsCompleted,
                vr.ProposedPriceCents,
                vr.Note,
                vr.VendorProfile.HomeLocation != null
                    ? vr.VendorProfile.HomeLocation.Distance(job.Location)
                    : null,
                vr.Status.ToString(),
                vr.VendorProfile.InsuranceVerified,
                vr.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return Result<List<VendorRequestDto>>.Success(vendorRequests);
    }
}
