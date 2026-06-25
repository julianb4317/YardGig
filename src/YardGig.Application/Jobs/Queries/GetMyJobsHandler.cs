using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Jobs.Dtos;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Queries;

public class GetMyJobsHandler(IAppDbContext db) : IRequestHandler<GetMyJobsQuery, PaginatedResult<JobDetailDto>>
{
    private static readonly Dictionary<JobStatus, int> StatusPriority = new()
    {
        [JobStatus.Open] = 0,
        [JobStatus.Requested] = 1,
        [JobStatus.Assigned] = 2,
        [JobStatus.InProgress] = 3,
        [JobStatus.Completed] = 4,
        [JobStatus.Disputed] = 5,
        [JobStatus.Paid] = 6,
        [JobStatus.Closed] = 7,
        [JobStatus.Cancelled] = 8,
        [JobStatus.Draft] = 9,
    };

    public async Task<PaginatedResult<JobDetailDto>> Handle(GetMyJobsQuery request, CancellationToken cancellationToken)
    {
        var query = db.JobRequests
            .AsNoTracking()
            .Include(j => j.CustomerProfile)
            .Include(j => j.VendorRequests)
            .Include(j => j.Assignment!)
                .ThenInclude(a => a.VendorProfile)
                    .ThenInclude(vp => vp.User)
            .Where(j => j.CustomerProfile.UserId == request.UserId);

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<JobStatus>(request.Status, true, out var status))
        {
            query = query.Where(j => j.Status == status);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var jobs = await query.ToListAsync(cancellationToken);

        var sorted = jobs
            .OrderBy(j => StatusPriority.GetValueOrDefault(j.Status, 99))
            .ThenByDescending(j => j.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        var items = sorted.Select(j =>
        {
            var pendingCount = j.VendorRequests?.Count(vr => vr.Status == VendorRequestStatus.Pending) ?? 0;
            var assignedVendorName = j.Assignment?.VendorProfile?.User?.DisplayName
                ?? j.Assignment?.VendorProfile?.BusinessName;

            return new JobDetailDto(
                j.Id,
                j.Title,
                j.Description,
                j.Categories.ToArray(),
                j.Address,
                j.Location?.Y ?? 0,
                j.Location?.X ?? 0,
                j.Status.ToString(),
                j.BudgetCents,
                j.ScheduleStart,
                j.ScheduleEnd,
                j.Photos?.ToArray(),
                j.CreatedAt,
                j.CustomerProfileId,
                pendingCount,
                assignedVendorName
            );
        }).ToList();

        return new PaginatedResult<JobDetailDto>(items, totalCount, request.Page, request.PageSize);
    }
}
