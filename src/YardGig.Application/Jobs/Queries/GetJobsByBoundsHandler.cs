using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Jobs.Dtos;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Queries;

public class GetJobsByBoundsHandler(IAppDbContext db) : IRequestHandler<GetJobsByBoundsQuery, MapQueryResponse>
{
    private const int HardLimit = 500;

    public async Task<MapQueryResponse> Handle(GetJobsByBoundsQuery request, CancellationToken cancellationToken)
    {
        var effectiveLimit = Math.Min(request.Limit, HardLimit);

        // Build bounding box envelope (minLng, minLat, maxLng, maxLat)
        var envelope = new Envelope(request.MinLng, request.MaxLng, request.MinLat, request.MaxLat);
        var boundingBox = new GeometryFactory(new PrecisionModel(), 4326)
            .ToGeometry(envelope);

        // Vendor's position for distance calculation (center of viewport as fallback)
        var vendorLat = request.VendorLat ?? (request.MinLat + request.MaxLat) / 2;
        var vendorLng = request.VendorLng ?? (request.MinLng + request.MaxLng) / 2;
        var vendorPoint = new Point(vendorLng, vendorLat) { SRID = 4326 };

        // Base query: open jobs within bounding box
        var query = db.JobRequests
            .AsNoTracking()
            .Where(j => j.Status == JobStatus.Open || j.Status == JobStatus.Requested)
            .Where(j => boundingBox.Contains(j.Location));

        // Category filter
        if (request.Categories is { Length: > 0 })
        {
            query = query.Where(j => j.Categories.Any(c => request.Categories.Contains(c)));
        }

        // Budget filters
        if (request.MinBudgetCents.HasValue)
        {
            query = query.Where(j => j.BudgetCents >= request.MinBudgetCents.Value);
        }
        if (request.MaxBudgetCents.HasValue)
        {
            query = query.Where(j => j.BudgetCents <= request.MaxBudgetCents.Value);
        }

        // Date filters
        if (request.DateFrom.HasValue)
        {
            query = query.Where(j => j.ScheduleStart == null || j.ScheduleStart >= request.DateFrom.Value);
        }
        if (request.DateTo.HasValue)
        {
            query = query.Where(j => j.ScheduleStart == null || j.ScheduleStart <= request.DateTo.Value);
        }

        // Count total before limit
        var totalInBounds = await query.CountAsync(cancellationToken);

        // Fetch pins with limit
        var jobs = await query
            .OrderBy(j => j.Location.Distance(vendorPoint))
            .Take(effectiveLimit)
            .Select(j => new
            {
                j.Id,
                j.Title,
                Categories = j.Categories.ToArray(),
                j.BudgetCents,
                Latitude = j.Location.Y,
                Longitude = j.Location.X,
                j.ScheduleStart,
                j.ScheduleEnd,
                Distance = j.Location.Distance(vendorPoint),
                j.ExpiresAt
            })
            .ToListAsync(cancellationToken);

        // Check which jobs this vendor has already requested
        HashSet<Guid> requestedJobIds = [];
        if (request.VendorProfileId.HasValue && jobs.Count > 0)
        {
            var jobIds = jobs.Select(j => j.Id).ToList();
            requestedJobIds = (await db.VendorRequests
                .AsNoTracking()
                .Where(vr => vr.VendorProfileId == request.VendorProfileId.Value
                    && jobIds.Contains(vr.JobRequestId))
                .Select(vr => vr.JobRequestId)
                .ToListAsync(cancellationToken))
                .ToHashSet();
        }

        var pins = jobs.Select(j => new MapPinDto(
            j.Id,
            j.Title,
            j.Categories,
            j.BudgetCents,
            j.Latitude,
            j.Longitude,
            j.ScheduleStart,
            j.ScheduleEnd,
            j.Distance,
            requestedJobIds.Contains(j.Id),
            j.ExpiresAt
        )).ToList();

        return new MapQueryResponse(pins, totalInBounds, totalInBounds > effectiveLimit);
    }
}
