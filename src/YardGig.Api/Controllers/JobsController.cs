using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Jobs.Commands;
using YardGig.Application.Jobs.Queries;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class JobsController(IMediator mediator, IAppDbContext db, ICurrentUserService currentUser) : ControllerBase
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
            if (result.Succeeded) return Ok(new { message = "Vendor assigned." });
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
        if (!Enum.TryParse<YardGig.Domain.Enums.JobStatus>(body.Status, true, out var status))
            return BadRequest(new { errors = new[] { "Invalid status value." } });

        try
        {
            var command = new UpdateJobStatusCommand(id, status);
            var result = await mediator.Send(command);
            return result.Succeeded ? Ok(new { status = status.ToString() }) : BadRequest(new { errors = result.Errors });
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
        var command = new CancelJobCommand(id, body?.Reason);
        var result = await mediator.Send(command);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

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
        return result.Succeeded
            ? Ok(new { message = "Schedule updated." })
            : BadRequest(result.Errors);
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
        return result.Succeeded
            ? Ok(new { message = "Request withdrawn." })
            : BadRequest(result.Errors);
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
}

public record RequestJobBody(int? ProposedPriceCents, string? Note);
public record AssignVendorBody(Guid VendorRequestId);
public record UpdateStatusBody(string Status);
public record CancelJobBody(string? Reason);
public record RescheduleJobBody(DateTime ScheduleStart, DateTime ScheduleEnd);
public record EditJobBody(string? Title, string? Description, string[]? Categories, int? BudgetCents, string[]? Photos);
