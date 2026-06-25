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

        // Vendor's position for distance calculation (center of viewport as fallback)
        var vendorLat = request.VendorLat ?? (request.MinLat + request.MaxLat) / 2;
        var vendorLng = request.VendorLng ?? (request.MinLng + request.MaxLng) / 2;

        // Fetch all open/requested jobs, then filter bounds in memory
        // This avoids PostGIS geography vs geometry translation issues
        var query = db.JobRequests
            .AsNoTracking()
            .Where(j => j.Status == JobStatus.Open || j.Status == JobStatus.Requested);

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

        var allJobs = await query.ToListAsync(cancellationToken);

        // Filter by bounds in memory (reliable regardless of column type)
        var inBounds = allJobs.Where(j =>
            j.Location != null &&
            j.Location.Y >= request.MinLat && j.Location.Y <= request.MaxLat &&
            j.Location.X >= request.MinLng && j.Location.X <= request.MaxLng
        ).ToList();

        var totalInBounds = inBounds.Count;

        // Sort by distance from vendor and take limit
        var jobs = inBounds
            .OrderBy(j => Math.Pow(j.Location!.Y - vendorLat, 2) + Math.Pow(j.Location!.X - vendorLng, 2))
            .Take(effectiveLimit)
            .ToList();

        // Check which jobs this vendor has an active request for (not withdrawn/rejected)
        HashSet<Guid> requestedJobIds = [];
        if (request.VendorProfileId.HasValue && jobs.Count > 0)
        {
            var jobIds = jobs.Select(j => j.Id).ToList();
            requestedJobIds = (await db.VendorRequests
                .AsNoTracking()
                .Where(vr => vr.VendorProfileId == request.VendorProfileId.Value
                    && jobIds.Contains(vr.JobRequestId)
                    && (vr.Status == Domain.Enums.VendorRequestStatus.Pending || vr.Status == Domain.Enums.VendorRequestStatus.Accepted))
                .Select(vr => vr.JobRequestId)
                .ToListAsync(cancellationToken))
                .ToHashSet();
        }

        var pins = jobs.Select(j =>
        {
            var distanceMeters = HaversineDistance(j.Location!.Y, j.Location!.X, vendorLat, vendorLng);
            return new MapPinDto(
                j.Id,
                j.Title,
                j.Categories.ToArray(),
                j.BudgetCents,
                j.Location!.Y,
                j.Location!.X,
                j.ScheduleStart,
                j.ScheduleEnd,
                distanceMeters,
                requestedJobIds.Contains(j.Id),
                j.ExpiresAt
            );
        }).ToList();

        return new MapQueryResponse(pins, totalInBounds, totalInBounds > effectiveLimit);
    }

    private static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000; // Earth radius in meters
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }
}
