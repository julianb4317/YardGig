using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Application.Jobs.Commands;
using Rakr.Application.Jobs.Queries;
using Rakr.Domain.Enums;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class JobsController(IMediator mediator, IAppDbContext db, ICurrentUserService currentUser, Rakr.Infrastructure.Services.JobNotifications jobNotifications) : ControllerBase
{
    /// <summary>
    /// Get open jobs within map viewport bounds.
    /// Primary endpoint for the vendor Map Discovery view.
    /// </summary>
    [HttpGet("map")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> GetJobsByBounds(
        [FromQuery] double minLat,
        [FromQuery] double maxLat,
        [FromQuery] double minLng,
        [FromQuery] double maxLng,
        [FromQuery] string? categories = null,
        [FromQuery] int? minBudget = null,
        [FromQuery] int? maxBudget = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] double? vendorLat = null,
        [FromQuery] double? vendorLng = null,
        [FromQuery] int limit = 200)
    {
        // Resolve vendor profile ID for "already requested" check
        Guid? vendorProfileId = null;
        if (currentUser.UserId.HasValue)
        {
            vendorProfileId = await db.VendorProfiles
                .Where(vp => vp.UserId == currentUser.UserId.Value)
                .Select(vp => vp.Id)
                .FirstOrDefaultAsync();
        }

        var categoriesArray = categories?.Split(',', StringSplitOptions.RemoveEmptyEntries);

        var query = new GetJobsByBoundsQuery(
            minLat, maxLat, minLng, maxLng,
            vendorLat, vendorLng, vendorProfileId,
            categoriesArray, minBudget, maxBudget,
            dateFrom, dateTo, limit);

        var result = await mediator.Send(query);
        return Ok(result);
    }

    /// <summary>
    /// Get nearby open jobs for map display (radius-based, legacy).
    /// </summary>
    /// </summary>
    [HttpGet("nearby")]
    public async Task<IActionResult> GetNearbyJobs(
        [FromQuery] double lat,
        [FromQuery] double lng,
        [FromQuery] double radiusMeters = 24140, // ~15 miles
        [FromQuery] string? categories = null,
        [FromQuery] int? minBudget = null,
        [FromQuery] int? maxBudget = null,
        [FromQuery] int limit = 200)
    {
        var categoriesArray = categories?.Split(',', StringSplitOptions.RemoveEmptyEntries);

        var query = new GetNearbyJobsQuery(lat, lng, radiusMeters, categoriesArray, minBudget, maxBudget, limit);
        var result = await mediator.Send(query);
        return Ok(result);
    }

    /// <summary>
    /// Get job details by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetJobDetail(Guid id)
    {
        var result = await mediator.Send(new GetJobDetailQuery(id));
        return result.Succeeded ? Ok(result.Data) : NotFound(result.Errors);
    }

    /// <summary>
    /// Get current customer's jobs (paginated).
    /// </summary>
    [HttpGet("mine")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetMyJobs(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (currentUser.UserId is null) return Unauthorized();
        try
        {
            var result = await mediator.Send(new GetMyJobsQuery(currentUser.UserId.Value, status, page, pageSize));
            return Ok(result);
        }
        catch (Exception ex)
        {
            // If query fails (e.g., missing tables/profile), return empty list rather than 500
            // This prevents the dashboard from showing an error state for new users
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<JobsController>>();
            logger.LogWarning(ex, "GetMyJobs failed for user {UserId}, returning empty result", currentUser.UserId);
            return Ok(new { items = Array.Empty<object>(), totalCount = 0, page, pageSize });
        }
    }

    /// <summary>
    /// Create a new job request (Customer).
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> CreateJob([FromBody] CreateJobCommand command)
    {
        try
        {
            var result = await mediator.Send(command);
            if (!result.Succeeded)
                return BadRequest(new { errors = result.Errors });

            return CreatedAtAction(nameof(GetJobDetail), new { id = result.Data }, new { id = result.Data });
        }
        catch (Exception ex)
        {
            // Walk the exception chain to find the real error
            var inner = ex;
            while (inner.InnerException != null) inner = inner.InnerException;
            return StatusCode(500, new { error = ex.Message, rootCause = inner.Message });
        }
    }

    /// <summary>
    /// Edit a job (title, description, categories, budget, photos).
    /// Only allowed when status is Open or Requested.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> EditJob(Guid id, [FromBody] EditJobBody body)
    {
        var command = new EditJobCommand(id, body.Title, body.Description, body.Categories, body.BudgetCents, body.Photos);
        var result = await mediator.Send(command);
        return result.Succeeded ? Ok() : BadRequest(result.Errors);
    }

    /// <summary>
    /// Vendor requests a job ("Request Job" button on map card).
    /// </summary>
    [HttpPost("{id:guid}/requests")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> RequestJob(Guid id, [FromBody] RequestJobBody body)
    {
        var command = new RequestJobCommand(id, body.ProposedPriceCents, body.Note);
        var result = await mediator.Send(command);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        // Notify customer about the new request
        var vendorProfile = await db.VendorProfiles.FirstOrDefaultAsync(v => v.UserId == currentUser.UserId);
        if (vendorProfile != null)
            try { await jobNotifications.NotifyJobRequested(id, vendorProfile.Id); } catch { /* notification non-fatal */ }

        return Ok(new { vendorRequestId = result.Data });
    }

    /// <summary>
    /// Customer assigns a vendor to the job.
    /// </summary>
    [HttpPut("{id:guid}/assign")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> AssignVendor(Guid id, [FromBody] AssignVendorBody body)
    {
        try
        {
            var command = new AssignVendorCommand(id, body.VendorRequestId);
            var result = await mediator.Send(command);
            if (result.Succeeded)
            {
                // Notify the assigned vendor
                var vendorReq = await db.VendorRequests.FirstOrDefaultAsync(vr => vr.Id == body.VendorRequestId);
                if (vendorReq != null)
                {
                    try { await jobNotifications.NotifyJobAssigned(id, vendorReq.VendorProfileId); } catch { /* notification non-fatal */ }

                    // If this is a recurring job template, assign vendor to the series too
                    var job = await db.JobRequests.FirstOrDefaultAsync(j => j.Id == id);
                    if (job is { IsRecurring: true })
                    {
                        var series = await db.RecurringJobSeries
                            .FirstOrDefaultAsync(s => s.TemplateJobId == id);
                        if (series != null)
                        {
                            series.AssignedVendorProfileId = vendorReq.VendorProfileId;
                            await db.SaveChangesAsync();
                        }
                    }
                }
                return Ok(new { message = "Vendor assigned." });
            }
            return BadRequest(new { errors = result.Errors });
        }
        catch (Exception ex)
        {
            var inner = ex; while (inner.InnerException != null) inner = inner.InnerException;
            return StatusCode(500, new { error = ex.Message, rootCause = inner.Message });
        }
    }

    /// <summary>
    /// Update job status (vendor marks in-progress/completed, etc.).
    /// </summary>
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusBody body)
    {
        if (!Enum.TryParse<Rakr.Domain.Enums.JobStatus>(body.Status, true, out var status))
            return BadRequest(new { errors = new[] { "Invalid status value." } });

        try
        {
            // If marking complete with photos, save them to the job
            if (status == Rakr.Domain.Enums.JobStatus.Completed && body.CompletionPhotos is { Length: > 0 })
            {
                var job = await db.JobRequests.FindAsync(id);
                if (job is not null)
                {
                    job.Photos = body.CompletionPhotos.ToList();
                    job.UpdatedAt = DateTime.UtcNow;
                }
            }

            var command = new UpdateJobStatusCommand(id, status);
            var result = await mediator.Send(command);
            if (result.Succeeded)
            {
                // Send notifications based on status change
                if (status == Rakr.Domain.Enums.JobStatus.InProgress)
                    try { await jobNotifications.NotifyJobStarted(id); } catch { /* notification non-fatal */ }
                else if (status == Rakr.Domain.Enums.JobStatus.Completed)
                    try { await jobNotifications.NotifyJobCompleted(id); } catch { /* notification non-fatal */ }
                return Ok(new { status = status.ToString() });
            }
            return BadRequest(new { errors = result.Errors });
        }
        catch (Exception ex)
        {
            var inner = ex; while (inner.InnerException != null) inner = inner.InnerException;
            return StatusCode(500, new { error = ex.Message, rootCause = inner.Message });
        }
    }

    /// <summary>
    /// Customer cancels a job.
    /// </summary>
    [HttpPut("{id:guid}/cancel")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> CancelJob(Guid id, [FromBody] CancelJobBody? body)
    {
        // Get vendor info before cancellation removes the assignment
        var job = await db.JobRequests.Include(j => j.Assignment).ThenInclude(a => a!.VendorProfile).FirstOrDefaultAsync(j => j.Id == id);
        var vendorUserIds = new List<Guid>();
        if (job?.Assignment?.VendorProfile != null)
            vendorUserIds.Add(job.Assignment.VendorProfile.UserId);

        // Also get pending vendors
        var pendingVendors = await db.VendorRequests
            .Include(vr => vr.VendorProfile)
            .Where(vr => vr.JobRequestId == id && vr.Status == Domain.Enums.VendorRequestStatus.Pending)
            .Select(vr => vr.VendorProfile.UserId)
            .ToListAsync();
        vendorUserIds.AddRange(pendingVendors);

        var command = new CancelJobCommand(id, body?.Reason);
        var result = await mediator.Send(command);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        // Notify all affected vendors
        foreach (var vendorUserId in vendorUserIds.Distinct())
            try { await jobNotifications.NotifyJobCancelled(id, vendorUserId, job?.Title ?? "Job"); } catch { /* notification non-fatal */ }

        return Ok(new { message = "Job cancelled.", result.Data!.PenaltyApplied, result.Data.PenaltyCents });
    }

    /// <summary>
    /// Customer reschedules a job.
    /// </summary>
    [HttpPut("{id:guid}/reschedule")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> RescheduleJob(Guid id, [FromBody] RescheduleJobBody body)
    {
        var command = new RescheduleJobCommand(id, body.ScheduleStart, body.ScheduleEnd);
        var result = await mediator.Send(command);
        if (result.Succeeded)
        {
            // Notify assigned vendor
            var job = await db.JobRequests.Include(j => j.Assignment).ThenInclude(a => a!.VendorProfile).FirstOrDefaultAsync(j => j.Id == id);
            if (job?.Assignment?.VendorProfile != null)
                try { await jobNotifications.NotifyJobRescheduled(id, job.Assignment.VendorProfile.UserId, job.Title); } catch { /* notification non-fatal */ }
            return Ok(new { message = "Schedule updated." });
        }
        return BadRequest(result.Errors);
    }

    /// <summary>
    /// List vendor requests for a job (Customer view).
    /// </summary>
    [HttpGet("{id:guid}/requests")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetJobRequests(Guid id)
    {
        var result = await mediator.Send(new GetJobRequestsQuery(id));
        return result.Succeeded ? Ok(result.Data) : BadRequest(result.Errors);
    }

    /// <summary>
    /// Vendor withdraws their own request for a job.
    /// </summary>
    [HttpDelete("{id:guid}/requests/mine")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> WithdrawRequest(Guid id)
    {
        var command = new WithdrawRequestCommand(id);
        var result = await mediator.Send(command);
        if (result.Succeeded)
        {
            // Notify customer
            var job = await db.JobRequests.Include(j => j.CustomerProfile).FirstOrDefaultAsync(j => j.Id == id);
            if (job?.CustomerProfile != null)
                try { await jobNotifications.NotifyVendorWithdrew(id, job.CustomerProfile.UserId, job.Title); } catch { /* notification non-fatal */ }
            return Ok(new { message = "Request withdrawn." });
        }
        return BadRequest(result.Errors);
    }

    /// <summary>
    /// Vendor views all their requests across jobs.
    /// </summary>
    [HttpGet("vendor/my-requests")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> GetVendorMyRequests()
    {
        if (currentUser.UserId is null) return Unauthorized();
        var result = await mediator.Send(new GetVendorMyRequestsQuery(currentUser.UserId.Value));
        return Ok(result);
    }

    /// <summary>
    /// Check if a job conflicts with the vendor's existing assigned/in-progress jobs.
    /// Returns any jobs that overlap in schedule.
    /// </summary>
    [HttpGet("{id:guid}/check-conflicts")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> CheckScheduleConflicts(Guid id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var targetJob = await db.JobRequests.AsNoTracking().FirstOrDefaultAsync(j => j.Id == id);
        if (targetJob is null) return NotFound();

        // If the target job has no schedule, there can be no time-based conflicts
        if (!targetJob.ScheduleStart.HasValue && !targetJob.ScheduleEnd.HasValue)
            return Ok(new { conflicts = Array.Empty<object>() });

        var vendorProfile = await db.VendorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value);

        if (vendorProfile is null)
            return Ok(new { conflicts = Array.Empty<object>() });

        // Get all jobs this vendor is assigned to or has pending requests for (active)
        var assignedJobIds = await db.JobAssignments
            .AsNoTracking()
            .Where(a => a.VendorProfileId == vendorProfile.Id)
            .Select(a => a.JobRequestId)
            .ToListAsync();

        var pendingRequestJobIds = await db.VendorRequests
            .AsNoTracking()
            .Where(vr => vr.VendorProfileId == vendorProfile.Id
                && (vr.Status == Domain.Enums.VendorRequestStatus.Pending || vr.Status == Domain.Enums.VendorRequestStatus.Accepted))
            .Select(vr => vr.JobRequestId)
            .ToListAsync();

        var existingJobIds = assignedJobIds.Concat(pendingRequestJobIds).Distinct().ToList();

        if (existingJobIds.Count == 0)
            return Ok(new { conflicts = Array.Empty<object>() });

        // Get those jobs with schedules
        var existingJobs = await db.JobRequests
            .AsNoTracking()
            .Where(j => existingJobIds.Contains(j.Id)
                && j.Status != Domain.Enums.JobStatus.Completed
                && j.Status != Domain.Enums.JobStatus.Paid
                && j.Status != Domain.Enums.JobStatus.Closed
                && j.Status != Domain.Enums.JobStatus.Cancelled
                && j.Status != Domain.Enums.JobStatus.Expired)
            .ToListAsync();

        // Check for overlapping schedules
        var targetStart = targetJob.ScheduleStart ?? DateTime.MinValue;
        var targetEnd = targetJob.ScheduleEnd ?? DateTime.MaxValue;

        var conflicts = existingJobs
            .Where(j =>
            {
                if (!j.ScheduleStart.HasValue && !j.ScheduleEnd.HasValue) return false;
                var existingStart = j.ScheduleStart ?? DateTime.MinValue;
                var existingEnd = j.ScheduleEnd ?? DateTime.MaxValue;
                // Overlap check: starts before other ends AND ends after other starts
                return targetStart < existingEnd && targetEnd > existingStart;
            })
            .Select(j => new
            {
                j.Id,
                j.Title,
                j.ScheduleStart,
                j.ScheduleEnd,
                Status = j.Status.ToString()
            })
            .ToList();

        return Ok(new { conflicts });
    }
}

public record RequestJobBody(int? ProposedPriceCents, string? Note);
public record AssignVendorBody(Guid VendorRequestId);
public record UpdateStatusBody(string Status, string[]? CompletionPhotos = null);
public record CancelJobBody(string? Reason);
public record RescheduleJobBody(DateTime ScheduleStart, DateTime ScheduleEnd);
public record EditJobBody(string? Title, string? Description, string[]? Categories, int? BudgetCents, string[]? Photos);
