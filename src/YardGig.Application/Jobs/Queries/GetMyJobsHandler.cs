using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Jobs.Dtos;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Queries;

public class GetMyJobsHandler(IAppDbContext db) : IRequestHandler<GetMyJobsQuery, PaginatedResult<JobDetailDto>>
{
    public async Task<PaginatedResult<JobDetailDto>> Handle(GetMyJobsQuery request, CancellationToken cancellationToken)
    {
        var query = db.JobRequests
            .AsNoTracking()
            .Include(j => j.CustomerProfile)
            .Where(j => j.CustomerProfile.UserId == request.UserId);

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<JobStatus>(request.Status, true, out var status))
        {
            query = query.Where(j => j.Status == status);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(j => new JobDetailDto(
                j.Id,
                j.Title,
                j.Description,
                j.Categories.ToArray(),
                j.Address,
                j.Location.Y,
                j.Location.X,
                j.Status.ToString(),
                j.BudgetCents,
                j.ScheduleStart,
                j.ScheduleEnd,
                j.Photos != null ? j.Photos.ToArray() : null,
                j.CreatedAt,
                j.CustomerProfileId
            ))
            .ToListAsync(cancellationToken);

        return new PaginatedResult<JobDetailDto>(items, totalCount, request.Page, request.PageSize);
    }
}
