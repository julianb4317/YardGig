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
        if (job is null) return NotFound(new { errors = new[] { "Job not found." } });

        if (job.Status != JobStatus.Completed && job.Status != JobStatus.Paid)
            return BadRequest(new { errors = new[] { "Can only dispute completed or paid jobs." } });

        var existingDispute = await db.Disputes
            .AnyAsync(d => d.JobRequestId == request.JobRequestId);

        if (existingDispute)
            return BadRequest(new { errors = new[] { "A dispute already exists for this job." } });

        var dispute = new Dispute
        {
            JobRequestId = request.JobRequestId,
            RaisedById = currentUser.UserId.Value,
            DisputeNumber = $"DSP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
            Summary = request.Summary,
            Reason = request.Reason,
            EvidencePhotos = request.EvidencePhotos?.ToList(),
            Status = DisputeStatus.Open
        };

        job.Status = JobStatus.Disputed;
        job.UpdatedAt = DateTime.UtcNow;

        db.Disputes.Add(dispute);
        await db.SaveChangesAsync();

        return Ok(new { disputeId = dispute.Id, disputeNumber = dispute.DisputeNumber });
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
                d.DisputeNumber,
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

    /// <summary>
    /// Get dispute details by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDispute(Guid id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var dispute = await db.Disputes
            .AsNoTracking()
            .Include(d => d.JobRequest)
            .Include(d => d.RaisedBy)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (dispute is null) return NotFound(new { errors = new[] { "Dispute not found." } });

        // Only the disputer or an admin can view
        if (dispute.RaisedById != currentUser.UserId.Value)
        {
            var isAdmin = currentUser.Roles.Contains("Admin") || currentUser.Roles.Contains("Owner");
            if (!isAdmin) return Forbid();
        }

        return Ok(new
        {
            dispute.Id,
            dispute.DisputeNumber,
            dispute.JobRequestId,
            JobTitle = dispute.JobRequest.Title,
            dispute.Summary,
            dispute.Reason,
            dispute.EvidencePhotos,
            Status = dispute.Status.ToString(),
            dispute.Resolution,
            dispute.ResolvedAt,
            dispute.CreatedAt,
            RaisedByName = dispute.RaisedBy.DisplayName
        });
    }

    /// <summary>
    /// Get messages for a dispute (chat between disputer and admin).
    /// </summary>
    [HttpGet("{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id, [FromQuery] int limit = 50)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var dispute = await db.Disputes.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
        if (dispute is null) return NotFound(new { errors = new[] { "Dispute not found." } });

        // Access check: disputer or admin
        if (dispute.RaisedById != currentUser.UserId.Value)
        {
            var isAdmin = currentUser.Roles.Contains("Admin") || currentUser.Roles.Contains("Owner");
            if (!isAdmin) return Forbid();
        }

        var messages = await db.DisputeMessages
            .AsNoTracking()
            .Where(m => m.DisputeId == id)
            .OrderBy(m => m.CreatedAt)
            .Take(limit)
            .ToListAsync();

        var senderIds = messages.Select(m => m.SenderUserId).Distinct().ToList();
        var senderNames = await db.Users.AsNoTracking()
            .Where(u => senderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName);

        var result = messages.Select(m => new
        {
            m.Id,
            m.SenderUserId,
            SenderName = senderNames.GetValueOrDefault(m.SenderUserId, "User"),
            m.Body,
            m.CreatedAt,
            m.IsRead,
            IsMe = m.SenderUserId == currentUser.UserId.Value
        });

        // Mark unread from other party as read
        var unread = await db.DisputeMessages
            .Where(m => m.DisputeId == id && m.SenderUserId != currentUser.UserId.Value && !m.IsRead)
            .ToListAsync();
        foreach (var m in unread) m.IsRead = true;
        if (unread.Count > 0) await db.SaveChangesAsync();

        return Ok(result);
    }

    /// <summary>
    /// Send a message in a dispute chat.
    /// </summary>
    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] DisputeMessageBody body)
    {
        if (currentUser.UserId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(body.Body))
            return BadRequest(new { errors = new[] { "Message cannot be empty." } });

        var dispute = await db.Disputes.FirstOrDefaultAsync(d => d.Id == id);
        if (dispute is null) return NotFound(new { errors = new[] { "Dispute not found." } });

        // Access check: disputer or admin
        if (dispute.RaisedById != currentUser.UserId.Value)
        {
            var isAdmin = currentUser.Roles.Contains("Admin") || currentUser.Roles.Contains("Owner");
            if (!isAdmin) return Forbid();
        }

        var message = new DisputeMessage
        {
            DisputeId = id,
            SenderUserId = currentUser.UserId.Value,
            Body = body.Body.Trim()
        };

        db.DisputeMessages.Add(message);
        await db.SaveChangesAsync();

        return Ok(new { messageId = message.Id, message.CreatedAt });
    }

    /// <summary>
    /// User closes their own dispute (withdraws it).
    /// Resets job status back to Completed so payment flow can resume.
    /// </summary>
    [HttpPut("{id:guid}/close")]
    public async Task<IActionResult> CloseDispute(Guid id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var dispute = await db.Disputes
            .Include(d => d.JobRequest)
                .ThenInclude(j => j.Assignment)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (dispute is null) return NotFound(new { errors = new[] { "Dispute not found." } });

        // Only the person who raised it can close it
        if (dispute.RaisedById != currentUser.UserId.Value)
            return BadRequest(new { errors = new[] { "Only the person who filed this dispute can close it." } });

        if (dispute.Status != DisputeStatus.Open && dispute.Status != DisputeStatus.Investigating)
            return BadRequest(new { errors = new[] { "This dispute is already closed." } });

        dispute.Status = DisputeStatus.Resolved;
        dispute.Resolution = "Closed by user";
        dispute.ResolvedAt = DateTime.UtcNow;

        // Reset job status to Completed so payment flow resumes (48h timer restarts)
        if (dispute.JobRequest.Status == JobStatus.Disputed)
        {
            dispute.JobRequest.Status = JobStatus.Completed;
            dispute.JobRequest.UpdatedAt = DateTime.UtcNow;
            if (dispute.JobRequest.Assignment != null)
            {
                dispute.JobRequest.Assignment.CompletedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        return Ok(new { success = true, message = "Dispute closed. Payment flow resumed." });
    }
}

public record RaiseDisputeRequest(Guid JobRequestId, string Summary, string Reason, string[]? EvidencePhotos = null);
public record DisputeMessageBody(string Body);
