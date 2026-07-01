using MediatR;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;

namespace Rakr.Application.Jobs.Queries;

public class GetVendorMyRequestsHandler(IAppDbContext db) : IRequestHandler<GetVendorMyRequestsQuery, List<VendorMyRequestDto>>
{
    public async Task<List<VendorMyRequestDto>> Handle(GetVendorMyRequestsQuery request, CancellationToken cancellationToken)
    {
        var results = await db.VendorRequests
            .AsNoTracking()
            .Include(vr => vr.VendorProfile)
            .Include(vr => vr.JobRequest)
            .Where(vr => vr.VendorProfile.UserId == request.UserId)
            .OrderByDescending(vr => vr.CreatedAt)
            .Select(vr => new VendorMyRequestDto(
                vr.Id,
                vr.JobRequestId,
                vr.JobRequest.Title,
                vr.JobRequest.BudgetCents,
                vr.Status.ToString(),
                vr.JobRequest.Status.ToString(),
                vr.ProposedPriceCents,
                vr.JobRequest.PricingType,
                vr.JobRequest.HourlyRateCents,
                vr.JobRequest.EstimatedHours,
                vr.JobRequest.MaxHours,
                vr.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return results;
    }
}
