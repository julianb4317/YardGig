using MediatR;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Jobs.Dtos;
using Rakr.Domain.Enums;

namespace Rakr.Application.Jobs.Queries;

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
        [JobStatus.Expired] = 9,
        [JobStatus.Draft] = 10,
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
            if (status == JobStatus.Expired)
            {
                // Expired tab: show explicitly expired OR open/requested with past end date
                query = query.Where(j => j.Status == JobStatus.Expired
                    || ((j.Status == JobStatus.Open || j.Status == JobStatus.Requested)
                        && j.ScheduleEnd.HasValue && j.ScheduleEnd.Value < DateTime.UtcNow));
            }
            else if (status == JobStatus.Open || status == JobStatus.Requested)
            {
                // Exclude jobs that should be expired
                query = query.Where(j => j.Status == status
                    && (!j.ScheduleEnd.HasValue || j.ScheduleEnd.Value >= DateTime.UtcNow));
            }
            else
            {
                query = query.Where(j => j.Status == status);
            }
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
            string? assignedVendorName = null;
            Guid? assignedVendorUserId = null;

            if (j.Assignment?.VendorProfile != null)
            {
                var vp = j.Assignment.VendorProfile;
                // BusinessName takes priority, then User.DisplayName, then fallback
                assignedVendorName = !string.IsNullOrEmpty(vp.BusinessName) ? vp.BusinessName
                    : vp.User?.DisplayName ?? vp.User?.Email ?? "Assigned Vendor";
                assignedVendorUserId = vp.UserId;
            }

            return new JobDetailDto(
                j.Id,
                j.Title,
                j.Description,
                j.Categories.ToArray(),
                j.Address,
                j.Location?.Y ?? 0,
                j.Location?.X ?? 0,
                // Auto-expire if end date passed
                (j.ScheduleEnd.HasValue && j.ScheduleEnd.Value < DateTime.UtcNow
                    && (j.Status == JobStatus.Open || j.Status == JobStatus.Requested))
                    ? "Expired" : j.Status.ToString(),
                j.BudgetCents,
                j.ScheduleStart,
                j.ScheduleEnd,
                j.Photos?.ToArray(),
                j.CreatedAt,
                j.CustomerProfileId,
                pendingCount,
                assignedVendorName,
                assignedVendorUserId,
                j.IsRecurring,
                j.RecurringFrequency,
                j.RecurringDays?.ToArray(),
                j.RecurringTime,
                j.PricingType,
                j.HourlyRateCents,
                j.EstimatedHours,
                j.MaxHours,
                j.Assignment?.StartedAt,
                j.Assignment?.CompletedAt,
                j.JobDetailsJson
            );
        }).ToList();

        return new PaginatedResult<JobDetailDto>(items, totalCount, request.Page, request.PageSize);
    }
}
