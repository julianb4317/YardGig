using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Jobs.Dtos;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Queries;

public class GetNearbyJobsHandler(IAppDbContext db) : IRequestHandler<GetNearbyJobsQuery, List<JobPinDto>>
{
    public async Task<List<JobPinDto>> Handle(GetNearbyJobsQuery request, CancellationToken cancellationToken)
    {
        var point = new Point(request.Longitude, request.Latitude) { SRID = 4326 };

        var query = db.JobRequests
            .AsNoTracking()
            .Where(j => j.Status == JobStatus.Open)
            .Where(j => j.Location.IsWithinDistance(point, request.RadiusMeters));

        if (request.Categories is { Length: > 0 })
        {
            query = query.Where(j => j.Categories.Any(c => request.Categories.Contains(c)));
        }

        if (request.MinBudgetCents.HasValue)
        {
            query = query.Where(j => j.BudgetCents >= request.MinBudgetCents.Value);
        }

        if (request.MaxBudgetCents.HasValue)
        {
            query = query.Where(j => j.BudgetCents <= request.MaxBudgetCents.Value);
        }

        var results = await query
            .OrderBy(j => j.Location.Distance(point))
            .Take(request.Limit)
            .Select(j => new JobPinDto(
                j.Id,
                j.Title,
                j.Categories.ToArray(),
                j.BudgetCents,
                j.Location.Y, // latitude
                j.Location.X, // longitude
                j.ScheduleStart,
                j.ScheduleEnd,
                j.Location.Distance(point)
            ))
            .ToListAsync(cancellationToken);

        return results;
    }
}
