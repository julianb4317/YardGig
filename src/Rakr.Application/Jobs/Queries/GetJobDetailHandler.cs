using MediatR;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Common.Models;
using Rakr.Application.Jobs.Dtos;
using Rakr.Domain.Enums;

namespace Rakr.Application.Jobs.Queries;

public class GetJobDetailHandler(IAppDbContext db) : IRequestHandler<GetJobDetailQuery, Result<JobDetailDto>>
{
    public async Task<Result<JobDetailDto>> Handle(GetJobDetailQuery request, CancellationToken cancellationToken)
    {
        var j = await db.JobRequests
            .Include(x => x.VendorRequests)
            .Include(x => x.Assignment!)
                .ThenInclude(a => a.VendorProfile)
                    .ThenInclude(vp => vp.User)
            .FirstOrDefaultAsync(x => x.Id == request.JobId, cancellationToken);

        if (j is null)
            return Result<JobDetailDto>.Failure("Job not found.");

        var pendingCount = j.VendorRequests?.Count(vr => vr.Status == VendorRequestStatus.Pending) ?? 0;
        string? assignedVendorName = null;
        Guid? assignedVendorUserId = null;

        if (j.Assignment?.VendorProfile != null)
        {
            var vp = j.Assignment.VendorProfile;
            assignedVendorName = !string.IsNullOrEmpty(vp.BusinessName) ? vp.BusinessName
                : vp.User?.DisplayName ?? vp.User?.Email ?? "Assigned Vendor";
            assignedVendorUserId = vp.UserId;
        }
        else
        {
            // Fallback: query assignment directly if Include didn't load it
            var assignment = await db.JobAssignments.AsNoTracking()
                .Include(a => a.VendorProfile)
                .FirstOrDefaultAsync(a => a.JobRequestId == j.Id, cancellationToken);
            if (assignment?.VendorProfile != null)
            {
                assignedVendorName = !string.IsNullOrEmpty(assignment.VendorProfile.BusinessName)
                    ? assignment.VendorProfile.BusinessName : "Assigned Vendor";
                assignedVendorUserId = assignment.VendorProfile.UserId;
            }
        }

        // Auto-expire if end date has passed and job is still open/requested
        var effectiveStatus = j.Status;
        if (j.ScheduleEnd.HasValue && j.ScheduleEnd.Value < DateTime.UtcNow
            && (j.Status == JobStatus.Open || j.Status == JobStatus.Requested))
        {
            effectiveStatus = JobStatus.Expired;
            j.Status = JobStatus.Expired;
            await db.SaveChangesAsync(cancellationToken);
        }

        var dto = new JobDetailDto(
            j.Id,
            j.Title,
            j.Description,
            j.Categories.ToArray(),
            j.Address,
            j.Location?.Y ?? 0,
            j.Location?.X ?? 0,
            effectiveStatus.ToString(),
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
            j.RecurringTime
        );

        return Result<JobDetailDto>.Success(dto);
    }
}
