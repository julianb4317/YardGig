using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/jobs/{jobId:guid}/messages")]
[Authorize]
public class MessagesController(IAppDbContext db, ICurrentUserService currentUser) : ControllerBase
{
    /// <summary>
    /// Get all messages for a job (between customer and assigned vendor).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMessages(Guid jobId, [FromQuery] int limit = 50)
    {
        if (currentUser.UserId is null) return Unauthorized();

        // Verify user is either the customer or the assigned vendor for this job
        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .Include(j => j.Assignment)
            .FirstOrDefaultAsync(j => j.Id == jobId);

        if (job is null) return NotFound();

        var isCustomer = job.CustomerProfile?.UserId == currentUser.UserId.Value;
        var isVendor = false;
        if (job.Assignment != null)
        {
            var vendorProfile = await db.VendorProfiles
                .FirstOrDefaultAsync(v => v.Id == job.Assignment.VendorProfileId);
            isVendor = vendorProfile?.UserId == currentUser.UserId.Value;
        }

        if (!isCustomer && !isVendor)
            return Forbid();

        var rawMessages = await db.JobMessages
            .AsNoTracking()
            .Where(m => m.JobRequestId == jobId)
            .OrderBy(m => m.CreatedAt)
            .Take(limit)
            .ToListAsync();

        // Get sender names
        var senderIds = rawMessages.Select(m => m.SenderUserId).Distinct().ToList();
        var senderNames = await db.Users.AsNoTracking()
            .Where(u => senderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName);

        var messages = rawMessages.Select(m => new
        {
            m.Id,
            m.SenderUserId,
            SenderName = senderNames.GetValueOrDefault(m.SenderUserId, "User"),
            m.Body,
            m.CreatedAt,
            m.IsRead,
            IsMe = m.SenderUserId == currentUser.UserId!.Value
        }).ToList();

        // Mark unread messages from other user as read
        var unread = await db.JobMessages
            .Where(m => m.JobRequestId == jobId && m.SenderUserId != currentUser.UserId.Value && !m.IsRead)
            .ToListAsync();
        foreach (var m in unread) m.IsRead = true;
        if (unread.Count > 0) await db.SaveChangesAsync();

        return Ok(messages);
    }

    /// <summary>
    /// Send a message on a job.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SendMessage(Guid jobId, [FromBody] SendMessageBody body)
    {
        if (currentUser.UserId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(body.Body))
            return BadRequest(new { errors = new[] { "Message cannot be empty." } });

        // Verify user is part of this job
        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .Include(j => j.Assignment)
            .FirstOrDefaultAsync(j => j.Id == jobId);

        if (job is null) return NotFound();

        var isCustomer = job.CustomerProfile?.UserId == currentUser.UserId.Value;
        var isVendor = false;
        Guid? otherUserId = null;

        if (job.Assignment != null)
        {
            var vendorProfile = await db.VendorProfiles
                .FirstOrDefaultAsync(v => v.Id == job.Assignment.VendorProfileId);
            isVendor = vendorProfile?.UserId == currentUser.UserId.Value;

            if (isCustomer && vendorProfile != null)
                otherUserId = vendorProfile.UserId;
            else if (isVendor)
                otherUserId = job.CustomerProfile?.UserId;
        }

        if (!isCustomer && !isVendor)
            return Forbid();

        var message = new JobMessage
        {
            JobRequestId = jobId,
            SenderUserId = currentUser.UserId.Value,
            Body = body.Body.Trim(),
        };

        db.JobMessages.Add(message);
        await db.SaveChangesAsync();

        return Ok(new { messageId = message.Id, message.CreatedAt });
    }
}

public record SendMessageBody(string Body);
