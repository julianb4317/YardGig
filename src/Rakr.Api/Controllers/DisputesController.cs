using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DisputesController(IAppDbContext db, ICurrentUserService currentUser) : ControllerBase
{
    /// <summary>
    /// Raise a dispute on a completed job.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> RaiseDispute([FromBody] RaiseDisputeRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var job = await db.JobRequests.FindAsync(request.JobRequestId);
        if (job is null) return NotFound("Job not found.");

        if (job.Status != JobStatus.Completed && job.Status != JobStatus.Paid)
            return BadRequest("Can only dispute completed or paid jobs.");

        var existingDispute = await db.Disputes
            .AnyAsync(d => d.JobRequestId == request.JobRequestId);

        if (existingDispute)
            return BadRequest("A dispute already exists for this job.");

        var dispute = new Dispute
        {
            JobRequestId = request.JobRequestId,
            RaisedById = currentUser.UserId.Value,
            Reason = request.Reason,
            Status = DisputeStatus.Open
        };

        job.Status = JobStatus.Disputed;
        job.UpdatedAt = DateTime.UtcNow;

        db.Disputes.Add(dispute);
        await db.SaveChangesAsync();

        return Ok(new { disputeId = dispute.Id });
    }

    /// <summary>
    /// Get current user's disputes.
    /// </summary>
    [HttpGet("mine")]
    public async Task<IActionResult> GetMyDisputes()
    {
        if (currentUser.UserId is null) return Unauthorized();

        var disputes = await db.Disputes
            .AsNoTracking()
            .Include(d => d.JobRequest)
            .Where(d => d.RaisedById == currentUser.UserId.Value)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new
            {
                d.Id,
                d.JobRequestId,
                JobTitle = d.JobRequest.Title,
                d.Reason,
                Status = d.Status.ToString(),
                d.Resolution,
                d.ResolvedAt,
                d.CreatedAt
            })
            .ToListAsync();

        return Ok(disputes);
    }
}

public record RaiseDisputeRequest(Guid JobRequestId, string Reason);
