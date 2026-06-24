using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Domain.Entities;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/notifications/preferences")]
[Authorize]
public class NotificationPreferencesController(IAppDbContext db, ICurrentUserService currentUser) : ControllerBase
{
    /// <summary>
    /// Get current user's notification preferences.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPreferences()
    {
        var prefs = await db.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.UserId == currentUser.UserId)
            .Select(p => new { p.EventType, p.Channel, p.Enabled, p.UpdatedAt })
            .ToListAsync();

        return Ok(prefs);
    }

    /// <summary>
    /// Update notification preferences (batch).
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdatePreferencesRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        foreach (var pref in request.Preferences)
        {
            var existing = await db.NotificationPreferences
                .FirstOrDefaultAsync(p =>
                    p.UserId == currentUser.UserId.Value &&
                    p.EventType == pref.EventType &&
                    p.Channel == pref.Channel);

            if (existing is not null)
            {
                existing.Enabled = pref.Enabled;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                db.NotificationPreferences.Add(new NotificationPreference
                {
                    UserId = currentUser.UserId.Value,
                    EventType = pref.EventType,
                    Channel = pref.Channel,
                    Enabled = pref.Enabled
                });
            }
        }

        await db.SaveChangesAsync();
        return Ok(new { message = "Preferences updated." });
    }

    /// <summary>
    /// Opt out of all non-critical notifications.
    /// </summary>
    [HttpPut("unsubscribe-all")]
    public async Task<IActionResult> UnsubscribeAll()
    {
        if (currentUser.UserId is null) return Unauthorized();

        var existing = await db.NotificationPreferences
            .Where(p => p.UserId == currentUser.UserId.Value)
            .ToListAsync();

        db.NotificationPreferences.RemoveRange(existing);

        // Add wildcard opt-out for each channel
        foreach (var channel in new[] { "email", "push", "sms" })
        {
            db.NotificationPreferences.Add(new NotificationPreference
            {
                UserId = currentUser.UserId.Value,
                EventType = "*",
                Channel = channel,
                Enabled = false
            });
        }

        await db.SaveChangesAsync();
        return Ok(new { message = "Unsubscribed from all non-critical notifications." });
    }

    /// <summary>
    /// Register a device token for push notifications.
    /// </summary>
    [HttpPost("/api/notifications/devices")]
    public async Task<IActionResult> RegisterDevice([FromBody] RegisterDeviceRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var existing = await db.UserDevices
            .FirstOrDefaultAsync(d => d.Token == request.Token && d.UserId == currentUser.UserId.Value);

        if (existing is not null)
        {
            existing.LastUsedAt = DateTime.UtcNow;
            existing.IsActive = true;
        }
        else
        {
            db.UserDevices.Add(new UserDevice
            {
                UserId = currentUser.UserId.Value,
                Platform = request.Platform,
                Token = request.Token
            });
        }

        await db.SaveChangesAsync();
        return Ok(new { message = "Device registered." });
    }

    /// <summary>
    /// Deactivate a device token.
    /// </summary>
    [HttpDelete("/api/notifications/devices/{id:guid}")]
    public async Task<IActionResult> RemoveDevice(Guid id)
    {
        var device = await db.UserDevices
            .FirstOrDefaultAsync(d => d.Id == id && d.UserId == currentUser.UserId);

        if (device is null) return NotFound();

        device.IsActive = false;
        await db.SaveChangesAsync();

        return Ok(new { message = "Device removed." });
    }
}

public record UpdatePreferencesRequest(PreferenceItem[] Preferences);
public record PreferenceItem(string EventType, string Channel, bool Enabled);
public record RegisterDeviceRequest(string Platform, string Token);
