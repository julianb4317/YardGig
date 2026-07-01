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
        if (!result.Succeeded) return NotFound(new { errors = result.Errors });

        // If the current user is a vendor, check if they already requested this job
        bool? vendorHasRequested = null;
        if (currentUser.UserId.HasValue)
        {
            var vendorProfile = await db.VendorProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value);

            if (vendorProfile != null)
            {
                vendorHasRequested = await db.VendorRequests
                    .AsNoTracking()
                    .AnyAsync(vr => vr.JobRequestId == id
                        && vr.VendorProfileId == vendorProfile.Id
                        && (vr.Status == Domain.Enums.VendorRequestStatus.Pending
                            || vr.Status == Domain.Enums.VendorRequestStatus.Accepted));
            }
        }

        // Return the DTO with the extra vendor field
        return Ok(new
        {
            result.Data!.Id,
            result.Data.Title,
            result.Data.Description,
            result.Data.Categories,
            result.Data.Address,
            result.Data.Latitude,
            result.Data.Longitude,
            result.Data.Status,
            result.Data.BudgetCents,
            result.Data.ScheduleStart,
            result.Data.ScheduleEnd,
            result.Data.Photos,
            result.Data.CreatedAt,
            result.Data.CustomerProfileId,
            result.Data.PendingRequestCount,
            result.Data.AssignedVendorName,
            result.Data.AssignedVendorUserId,
            result.Data.IsRecurring,
            result.Data.RecurringFrequency,
            result.Data.RecurringDays,
            result.Data.RecurringTime,
            result.Data.PricingType,
            result.Data.HourlyRateCents,
            result.Data.EstimatedHours,
            result.Data.MaxHours,
            result.Data.AssignmentStartedAt,
            result.Data.AssignmentCompletedAt,
            VendorHasRequested = vendorHasRequested,
            OriginalBudgetCents = await db.JobRequests.AsNoTracking()
                .Where(j => j.Id == id)
                .Select(j => j.OriginalBudgetCents)
                .FirstOrDefaultAsync(),
            result.Data.JobDetailsJson
        });
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
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<JobsController>>();
            logger.LogError(ex, "Unhandled error in {Action}", nameof(CreateJob));
            return StatusCode(500, new { errors = new[] { "An unexpected error occurred. Please try again." } });
        }
    }

    /// <summary>
    /// Edit a job (title, description, categories, budget, schedule, photos).
    /// Only allowed when status is Open. If budget changes, re-authorizes the payment hold.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> EditJob(Guid id, [FromBody] EditJobBody body)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (job is null) return NotFound(new { errors = new[] { "Job not found." } });
        if (job.CustomerProfile?.UserId != currentUser.UserId.Value)
            return BadRequest(new { errors = new[] { "Only the job owner can edit." } });
        if (job.Status != JobStatus.Open)
            return BadRequest(new { errors = new[] { "Job can only be edited while in Open status." } });

        var oldBudgetCents = job.BudgetCents;
        var budgetChanged = body.BudgetCents.HasValue && body.BudgetCents.Value != oldBudgetCents;

        // Apply edits
        if (body.Title is not null) job.Title = body.Title;
        if (body.Description is not null) job.Description = body.Description;
        if (body.Categories is not null) job.Categories = body.Categories.ToList();
        if (body.HourlyRateCents.HasValue) job.HourlyRateCents = body.HourlyRateCents.Value;
        if (body.EstimatedHours.HasValue) job.EstimatedHours = body.EstimatedHours.Value;
        if (body.MaxHours.HasValue) job.MaxHours = body.MaxHours.Value;
        if (body.BudgetCents.HasValue)
        {
            // Track original budget on first change
            if (job.OriginalBudgetCents is null && body.BudgetCents.Value != job.BudgetCents)
                job.OriginalBudgetCents = job.BudgetCents;
            job.BudgetCents = body.BudgetCents.Value;
        }
        if (body.ScheduleStart.HasValue) job.ScheduleStart = body.ScheduleStart.Value;
        if (body.ScheduleEnd.HasValue) job.ScheduleEnd = body.ScheduleEnd.Value;
        if (body.Photos is not null) job.Photos = body.Photos.ToList();
        if (body.JobDetailsJson is not null) job.JobDetailsJson = body.JobDetailsJson;
        job.UpdatedAt = DateTime.UtcNow;

        // If budget changed, release old auth and create new one
        if (budgetChanged)
        {
            var paymentSvc = HttpContext.RequestServices.GetRequiredService<IPaymentService>();
            var commSvc = HttpContext.RequestServices.GetRequiredService<ICommissionService>();

            // Release existing auth
            var existingEscrow = await db.EscrowTransactions
                .FirstOrDefaultAsync(e => e.JobRequestId == job.Id
                    && (e.Status == Rakr.Domain.Entities.EscrowStatus.Authorized));
            if (existingEscrow != null && !string.IsNullOrEmpty(existingEscrow.StripePaymentIntentId))
            {
                await paymentSvc.ReleaseAuthorizationAsync(existingEscrow.StripePaymentIntentId);
                existingEscrow.Status = Rakr.Domain.Entities.EscrowStatus.Refunded;
                existingEscrow.RefundedAt = DateTime.UtcNow;
            }

            // Create new auth for updated amount
            var card = await db.CustomerPaymentMethods
                .FirstOrDefaultAsync(pm => pm.CustomerProfileId == job.CustomerProfile!.Id && pm.IsDefault);

            if (card != null)
            {
                var fees = await commSvc.CalculateFeesAsync(job.BudgetCents, Guid.Empty, job.Categories.ToArray());
                var authResult = await paymentSvc.AuthorizePaymentAsync(
                    card.StripeCustomerId, card.StripePaymentMethodId,
                    fees.TotalChargeCents, "usd", $"auth_edit_{job.Id}_{Guid.NewGuid():N}",
                    $"Rakr hold: {job.Title[..Math.Min(job.Title.Length, 25)]}");

                if (authResult.Succeeded)
                {
                    db.EscrowTransactions.Add(new Domain.Entities.EscrowTransaction
                    {
                        JobRequestId = job.Id,
                        CustomerProfileId = job.CustomerProfile!.Id,
                        StripePaymentIntentId = authResult.PaymentIntentId,
                        AmountCents = fees.TotalChargeCents,
                        BudgetCents = fees.BudgetCents,
                        TrustFeeCents = fees.TrustFeeCents,
                        ProcessingFeeCents = fees.ProcessingFeeCents,
                        PlatformFeeCents = fees.TrustFeeCents,
                        VendorAmountCents = fees.BudgetCents,
                        Status = Rakr.Domain.Entities.EscrowStatus.Authorized
                    });
                }
            }
        }

        await db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            budgetChanged,
            oldBudgetCents = budgetChanged ? oldBudgetCents : (int?)null,
            newBudgetCents = budgetChanged ? job.BudgetCents : (int?)null
        });
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
            return BadRequest(new { errors = result.Errors });

        // Notify customer about the new request
        var vendorProfile = await db.VendorProfiles.FirstOrDefaultAsync(v => v.UserId == currentUser.UserId);
        if (vendorProfile != null)
            try { await jobNotifications.NotifyJobRequested(id, vendorProfile.Id); } catch { /* notification non-fatal */ }

        return Ok(new { vendorRequestId = result.Data });
    }

    /// <summary>
    /// Customer assigns a vendor to the job.
    /// If vendor proposed a higher price, charges the difference to escrow.
    /// </summary>
    [HttpPut("{id:guid}/assign")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> AssignVendor(Guid id, [FromBody] AssignVendorBody body)
    {
        try
        {
            // Check if there's a price difference that needs to be charged
            var vendorReq = await db.VendorRequests.FirstOrDefaultAsync(vr => vr.Id == body.VendorRequestId);
            if (vendorReq is null)
                return NotFound(new { errors = new[] { "Vendor request not found." } });

            var job = await db.JobRequests
                .Include(j => j.CustomerProfile)
                .FirstOrDefaultAsync(j => j.Id == id);
            if (job is null)
                return NotFound(new { errors = new[] { "Job not found." } });

            // Determine effective price: vendor's proposed price if higher, else budget
            var effectivePriceCents = job.BudgetCents;
            if (vendorReq.ProposedPriceCents.HasValue && vendorReq.ProposedPriceCents.Value > job.BudgetCents)
            {
                effectivePriceCents = vendorReq.ProposedPriceCents.Value;

                // If caller hasn't confirmed the higher price, return the price info so frontend can show confirmation
                if (!body.ConfirmedPriceCents.HasValue || body.ConfirmedPriceCents.Value != effectivePriceCents)
                {
                    var commSvc = HttpContext.RequestServices.GetRequiredService<ICommissionService>();
                    var previewFees = await commSvc.CalculateFeesAsync(effectivePriceCents, Guid.Empty, job.Categories.ToArray());
                    return Ok(new
                    {
                        requiresPriceConfirmation = true,
                        originalBudgetCents = job.BudgetCents,
                        vendorPriceCents = effectivePriceCents,
                        differenceCents = effectivePriceCents - job.BudgetCents,
                        newTotalChargeCents = previewFees.TotalChargeCents,
                        newTrustFeeCents = previewFees.TrustFeeCents,
                        newProcessingFeeCents = previewFees.ProcessingFeeCents
                    });
                }

                // Price difference confirmed — release old auth and create new one for the full new amount
                var paymentSvc = HttpContext.RequestServices.GetRequiredService<IPaymentService>();

                // Release old authorization
                var oldEscrow = await db.EscrowTransactions
                    .FirstOrDefaultAsync(e => e.JobRequestId == job.Id
                        && (e.Status == Rakr.Domain.Entities.EscrowStatus.Authorized || e.Status == Rakr.Domain.Entities.EscrowStatus.Held));
                if (oldEscrow != null && !string.IsNullOrEmpty(oldEscrow.StripePaymentIntentId))
                {
                    await paymentSvc.ReleaseAuthorizationAsync(oldEscrow.StripePaymentIntentId);
                    oldEscrow.Status = Rakr.Domain.Entities.EscrowStatus.Refunded;
                    oldEscrow.RefundedAt = DateTime.UtcNow;
                }

                // Create new auth for the higher amount
                var card = await db.CustomerPaymentMethods
                    .FirstOrDefaultAsync(pm => pm.CustomerProfileId == job.CustomerProfile!.Id && pm.IsDefault);
                if (card is null)
                    return BadRequest(new { errors = new[] { "No payment method on file. Please add a card in Settings." } });

                var commSvc2 = HttpContext.RequestServices.GetRequiredService<ICommissionService>();
                var newFees = await commSvc2.CalculateFeesAsync(effectivePriceCents, Guid.Empty, job.Categories.ToArray());
                var authResult = await paymentSvc.AuthorizePaymentAsync(
                    card.StripeCustomerId, card.StripePaymentMethodId,
                    newFees.TotalChargeCents, "usd", $"auth_upgrade_{job.Id}_{Guid.NewGuid():N}",
                    $"Rakr hold: {job.Title[..Math.Min(job.Title.Length, 25)]}");

                if (!authResult.Succeeded)
                    return BadRequest(new { errors = new[] { "Failed to authorize the new amount. Please check your payment method." } });

                // Create new escrow entry
                db.EscrowTransactions.Add(new Domain.Entities.EscrowTransaction
                {
                    JobRequestId = job.Id,
                    CustomerProfileId = job.CustomerProfile!.Id,
                    StripePaymentIntentId = authResult.PaymentIntentId,
                    AmountCents = newFees.TotalChargeCents,
                    BudgetCents = newFees.BudgetCents,
                    TrustFeeCents = newFees.TrustFeeCents,
                    ProcessingFeeCents = newFees.ProcessingFeeCents,
                    PlatformFeeCents = newFees.TrustFeeCents,
                    VendorAmountCents = newFees.BudgetCents,
                    Status = Rakr.Domain.Entities.EscrowStatus.Authorized
                });

                // Update the job's budget to the new effective price
                job.BudgetCents = effectivePriceCents;
                job.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }

            // Now proceed with the actual assignment
            var command = new AssignVendorCommand(id, body.VendorRequestId);
            var result = await mediator.Send(command);
            if (result.Succeeded)
            {
                // CAPTURE the authorization hold for FIXED-PRICE jobs only
                // Hourly jobs keep the auth hold until customer verifies actual hours (partial capture)
                if (job.PricingType != "hourly")
                {
                    var capturePaymentSvc = HttpContext.RequestServices.GetRequiredService<IPaymentService>();
                    var escrowToCapture = await db.EscrowTransactions
                        .FirstOrDefaultAsync(e => e.JobRequestId == id && e.Status == Rakr.Domain.Entities.EscrowStatus.Authorized);
                    if (escrowToCapture != null && !string.IsNullOrEmpty(escrowToCapture.StripePaymentIntentId))
                    {
                        var captureResult = await capturePaymentSvc.CapturePaymentAsync(escrowToCapture.StripePaymentIntentId);
                        if (captureResult.Succeeded)
                        {
                            escrowToCapture.Status = Rakr.Domain.Entities.EscrowStatus.Held;
                            escrowToCapture.CapturedAt = DateTime.UtcNow;
                            await db.SaveChangesAsync();
                        }
                    }
                }

                // Notify the assigned vendor
                try { await jobNotifications.NotifyJobAssigned(id, vendorReq.VendorProfileId); } catch { /* notification non-fatal */ }

                // If this is a recurring job template, assign vendor to the series too
                if (job.IsRecurring)
                {
                    var series = await db.RecurringJobSeries
                        .FirstOrDefaultAsync(s => s.TemplateJobId == id);
                    if (series != null)
                    {
                        series.AssignedVendorProfileId = vendorReq.VendorProfileId;
                        await db.SaveChangesAsync();
                    }
                }

                return Ok(new { message = "Vendor assigned.", priceCents = effectivePriceCents });
            }
            return BadRequest(new { errors = result.Errors });
        }
        catch (Exception ex)
        {
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<JobsController>>();
            logger.LogError(ex, "Unhandled error in {Action}", nameof(AssignVendor));
            return StatusCode(500, new { errors = new[] { "An unexpected error occurred. Please try again." } });
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
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<JobsController>>();
            logger.LogError(ex, "Unhandled error in {Action}", nameof(UpdateStatus));
            return StatusCode(500, new { errors = new[] { "An unexpected error occurred. Please try again." } });
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
            return BadRequest(new { errors = result.Errors });

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
        return BadRequest(new { errors = result.Errors });
    }

    /// <summary>
    /// List vendor requests for a job (Customer view).
    /// </summary>
    [HttpGet("{id:guid}/requests")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetJobRequests(Guid id)
    {
        var result = await mediator.Send(new GetJobRequestsQuery(id));
        return result.Succeeded ? Ok(result.Data) : BadRequest(new { errors = result.Errors });
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
        return BadRequest(new { errors = result.Errors });
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
public record AssignVendorBody(Guid VendorRequestId, int? ConfirmedPriceCents = null);
public record UpdateStatusBody(string Status, string[]? CompletionPhotos = null);
public record CancelJobBody(string? Reason);
public record RescheduleJobBody(DateTime ScheduleStart, DateTime ScheduleEnd);
public record EditJobBody(string? Title, string? Description, string[]? Categories, int? BudgetCents, string[]? Photos, DateTime? ScheduleStart = null, DateTime? ScheduleEnd = null, string? JobDetailsJson = null, int? HourlyRateCents = null, decimal? EstimatedHours = null, decimal? MaxHours = null);
