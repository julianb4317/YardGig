using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;

namespace YardGig.Application.Jobs.Queries;

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
                vr.ProposedPriceCents,
                vr.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return results;
    }
}
