using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;
using Rakr.Infrastructure.Services;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/recurring-jobs")]
[Authorize]
public class RecurringJobsController(IAppDbContext db, ICurrentUserService currentUser) : ControllerBase
{
    /// <summary>
    /// Get recurring series for the current customer.
    /// </summary>
    [HttpGet("mine")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetMySeries()
    {
        if (currentUser.UserId is null) return Unauthorized();

        var series = await db.RecurringJobSeries
            .AsNoTracking()
            .Include(s => s.TemplateJob)
            .Include(s => s.AssignedVendorProfile)
                .ThenInclude(v => v!.User)
            .Where(s => s.CustomerProfile.UserId == currentUser.UserId.Value)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new
            {
                s.Id,
                s.TemplateJobId,
                TemplateTitle = s.TemplateJob.Title,
                BudgetCents = s.TemplateJob.BudgetCents,
                s.Frequency,
                s.Days,
                s.Time,
                Status = s.Status.ToString(),
                s.NextOccurrence,
                s.TotalOccurrences,
                s.CreatedAt,
                AssignedVendorName = s.AssignedVendorProfile != null
                    ? (s.AssignedVendorProfile.BusinessName ?? s.AssignedVendorProfile.User!.DisplayName)
                    : null
            })
            .ToListAsync();

        return Ok(series);
    }

    /// <summary>
    /// Get a specific recurring series with its child job history.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetSeries(Guid id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var series = await db.RecurringJobSeries
            .AsNoTracking()
            .Include(s => s.TemplateJob)
            .Include(s => s.AssignedVendorProfile)
                .ThenInclude(v => v!.User)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (series is null) return NotFound();

        // Verify access (customer who owns it, or assigned vendor)
        var customerProfile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);
        var vendorProfile = await db.VendorProfiles
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value);

        var isOwner = customerProfile?.Id == series.CustomerProfileId;
        var isAssignedVendor = vendorProfile?.Id == series.AssignedVendorProfileId;

        if (!isOwner && !isAssignedVendor) return Forbid();

        // Get child instances (spawned from this series)
        var childJobs = await db.JobRequests
            .AsNoTracking()
            .Where(j => j.ParentJobId == series.TemplateJobId)
            .OrderByDescending(j => j.CreatedAt)
            .Take(20)
            .Select(j => new
            {
                j.Id,
                j.Title,
                Status = j.Status.ToString(),
                j.ScheduleStart,
                j.BudgetCents,
                j.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            series.Id,
            series.TemplateJobId,
            TemplateTitle = series.TemplateJob.Title,
            TemplateDescription = series.TemplateJob.Description,
            BudgetCents = series.TemplateJob.BudgetCents,
            Categories = series.TemplateJob.Categories,
            series.Frequency,
            series.Days,
            series.Time,
            Status = series.Status.ToString(),
            series.NextOccurrence,
            series.TotalOccurrences,
            series.CreatedAt,
            AssignedVendorName = series.AssignedVendorProfile != null
                ? (series.AssignedVendorProfile.BusinessName ?? series.AssignedVendorProfile.User!.DisplayName)
                : null,
            AssignedVendorProfileId = series.AssignedVendorProfileId,
            Occurrences = childJobs
        });
    }

    /// <summary>
    /// Pause an active recurring series.
    /// </summary>
    [HttpPut("{id:guid}/pause")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> PauseSeries(Guid id)
    {
        var series = await GetOwnedSeries(id);
        if (series is null) return NotFound();

        if (series.Status != RecurringSeriesStatus.Active)
            return BadRequest(new { errors = new[] { "Only active series can be paused." } });

        series.Status = RecurringSeriesStatus.Paused;
        await db.SaveChangesAsync();

        return Ok(new { status = "Paused" });
    }

    /// <summary>
    /// Resume a paused or payment-required series.
    /// </summary>
    [HttpPut("{id:guid}/resume")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> ResumeSeries(Guid id)
    {
        var series = await GetOwnedSeries(id);
        if (series is null) return NotFound();

        if (series.Status != RecurringSeriesStatus.Paused && series.Status != RecurringSeriesStatus.PaymentRequired)
            return BadRequest(new { errors = new[] { "Only paused or payment-required series can be resumed." } });

        // If resuming from PaymentRequired, verify card exists
        if (series.Status == RecurringSeriesStatus.PaymentRequired)
        {
            var card = await db.CustomerPaymentMethods
                .FirstOrDefaultAsync(pm => pm.CustomerProfileId == series.CustomerProfileId && pm.IsDefault);
            if (card is null)
                return BadRequest(new { errors = new[] { "Add a payment method before resuming." } });
        }

        series.Status = RecurringSeriesStatus.Active;
        // Recalculate next occurrence
        series.NextOccurrence = RecurringJobSpawner.CalculateNextOccurrence(series);
        await db.SaveChangesAsync();

        return Ok(new { status = "Active", nextOccurrence = series.NextOccurrence });
    }

    /// <summary>
    /// Cancel a recurring series permanently.
    /// </summary>
    [HttpPut("{id:guid}/cancel")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> CancelSeries(Guid id)
    {
        var series = await GetOwnedSeries(id);
        if (series is null) return NotFound();

        if (series.Status == RecurringSeriesStatus.Cancelled)
            return BadRequest(new { errors = new[] { "Series is already cancelled." } });

        series.Status = RecurringSeriesStatus.Cancelled;
        series.NextOccurrence = null;
        await db.SaveChangesAsync();

        return Ok(new { status = "Cancelled" });
    }

    /// <summary>
    /// Vendor: Get upcoming recurring schedule.
    /// </summary>
    [HttpGet("vendor/schedule")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> GetVendorSchedule()
    {
        if (currentUser.UserId is null) return Unauthorized();

        var vendorProfile = await db.VendorProfiles
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value);

        if (vendorProfile is null)
            return Ok(Array.Empty<object>());

        var series = await db.RecurringJobSeries
            .AsNoTracking()
            .Include(s => s.TemplateJob)
            .Where(s => s.AssignedVendorProfileId == vendorProfile.Id
                && s.Status == RecurringSeriesStatus.Active)
            .OrderBy(s => s.NextOccurrence)
            .Select(s => new
            {
                s.Id,
                s.TemplateJobId,
                Title = s.TemplateJob.Title,
                BudgetCents = s.TemplateJob.BudgetCents,
                Address = s.TemplateJob.Address,
                s.Frequency,
                s.Days,
                s.Time,
                s.NextOccurrence
            })
            .ToListAsync();

        return Ok(series);
    }

    /// <summary>
    /// Vendor: Withdraw from a recurring series.
    /// </summary>
    [HttpPut("{id:guid}/withdraw")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> WithdrawFromSeries(Guid id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var vendorProfile = await db.VendorProfiles
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId.Value);
        if (vendorProfile is null) return NotFound();

        var series = await db.RecurringJobSeries
            .Include(s => s.CustomerProfile)
            .FirstOrDefaultAsync(s => s.Id == id && s.AssignedVendorProfileId == vendorProfile.Id);

        if (series is null) return NotFound();

        series.AssignedVendorProfileId = null;
        series.AssignedVendorProfile = null;
        await db.SaveChangesAsync();

        // Notify customer
        var notificationService = HttpContext.RequestServices.GetRequiredService<INotificationService>();
        await notificationService.SendInAppNotificationAsync(
            series.CustomerProfile.UserId,
            "vendor_withdrew_recurring",
            "Vendor withdrew from recurring job",
            "Your assigned vendor has withdrawn from the recurring series. New requests will be accepted.",
            new { seriesId = series.Id });

        return Ok(new { success = true });
    }

    private async Task<RecurringJobSeries?> GetOwnedSeries(Guid seriesId)
    {
        if (currentUser.UserId is null) return null;

        var customerProfile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);
        if (customerProfile is null) return null;

        return await db.RecurringJobSeries
            .FirstOrDefaultAsync(s => s.Id == seriesId && s.CustomerProfileId == customerProfile.Id);
    }
}
