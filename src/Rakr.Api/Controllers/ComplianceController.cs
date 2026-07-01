using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class ComplianceController(IAppDbContext db, ICurrentUserService currentUser) : ControllerBase
{
    // ─────────────────── CONSENT RECORDS ───────────────────

    /// <summary>
    /// Record user consent for a legal document.
    /// </summary>
    [HttpPost("consent")]
    public async Task<IActionResult> RecordConsent([FromBody] RecordConsentRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var record = new ConsentRecord
        {
            UserId = currentUser.UserId.Value,
            ConsentType = request.ConsentType,
            Version = request.Version,
            Granted = request.Granted,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext.Request.Headers.UserAgent.ToString(),
            DocumentHash = request.DocumentHash
        };

        db.ConsentRecords.Add(record);
        await db.SaveChangesAsync();

        return Ok(new { consentId = record.Id });
    }

    /// <summary>
    /// Get current user's consent history.
    /// </summary>
    [HttpGet("consent")]
    public async Task<IActionResult> GetConsents()
    {
        var consents = await db.ConsentRecords
            .AsNoTracking()
            .Where(c => c.UserId == currentUser.UserId)
            .OrderByDescending(c => c.ConsentedAt)
            .Select(c => new
            {
                c.ConsentType, c.Version, c.Granted,
                c.ConsentedAt, c.RevokedAt
            })
            .ToListAsync();

        return Ok(consents);
    }

    /// <summary>
    /// Revoke a specific consent (marketing, analytics, etc.).
    /// Non-revocable consents (ToS, Privacy) require account deletion.
    /// </summary>
    [HttpPost("consent/revoke")]
    public async Task<IActionResult> RevokeConsent([FromBody] RevokeConsentRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var nonRevocable = new[] { "terms_of_service", "privacy_policy", "data_processing" };
        if (nonRevocable.Contains(request.ConsentType))
            return BadRequest(new { errors = new[] { "This consent cannot be revoked. To withdraw, please delete your account." } });

        // Create revocation record
        var record = new ConsentRecord
        {
            UserId = currentUser.UserId.Value,
            ConsentType = request.ConsentType,
            Version = request.Version,
            Granted = false,
            RevokedAt = DateTime.UtcNow,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext.Request.Headers.UserAgent.ToString()
        };

        db.ConsentRecords.Add(record);
        await db.SaveChangesAsync();

        return Ok(new { message = "Consent revoked." });
    }

    // ─────────────────── ABUSE REPORTING ───────────────────

    /// <summary>
    /// Submit an abuse report.
    /// </summary>
    [HttpPost("reports")]
    public async Task<IActionResult> SubmitReport([FromBody] SubmitReportRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var validReasons = new[] { "spam", "fraud", "harassment", "inappropriate_content", "no_show", "unsafe_behavior", "other" };
        if (!validReasons.Contains(request.Reason))
            return BadRequest(new { errors = new[] { "Invalid reason category." } });

        var validEntityTypes = new[] { "User", "JobRequest", "Rating", "VendorProfile" };
        if (!validEntityTypes.Contains(request.EntityType))
            return BadRequest(new { errors = new[] { "Invalid entity type." } });

        var report = new AbuseReport
        {
            ReporterId = currentUser.UserId.Value,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            Reason = request.Reason,
            Description = request.Description,
            EvidenceUrls = request.EvidenceUrls
        };

        db.AbuseReports.Add(report);
        await db.SaveChangesAsync();

        return Ok(new { reportId = report.Id, message = "Report received. We'll review within 24 hours." });
    }

    // ─────────────────── PRIVACY RIGHTS ───────────────────

    /// <summary>
    /// CCPA: Opt out of data sale/sharing.
    /// </summary>
    [HttpPost("privacy/opt-out")]
    [AllowAnonymous]
    public async Task<IActionResult> OptOutOfSale()
    {
        if (currentUser.UserId.HasValue)
        {
            db.ConsentRecords.Add(new ConsentRecord
            {
                UserId = currentUser.UserId.Value,
                ConsentType = "data_sale_opt_out",
                Version = "v1.0",
                Granted = false,
                RevokedAt = DateTime.UtcNow,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            });
            await db.SaveChangesAsync();
        }

        // Set cookie for non-authenticated opt-out
        HttpContext.Response.Cookies.Append("ccpa_optout", "1", new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            MaxAge = TimeSpan.FromDays(365)
        });

        return Ok(new { message = "You have been opted out of data sale/sharing." });
    }

    /// <summary>
    /// Request data export (Right to Know).
    /// </summary>
    [HttpPost("privacy/export")]
    public async Task<IActionResult> RequestDataExport()
    {
        if (currentUser.UserId is null) return Unauthorized();

        // In production: queue a background job to compile data package
        // For now: acknowledge the request
        db.AuditEntries.Add(new AuditEntry
        {
            ActorId = currentUser.UserId,
            Action = "privacy.data_export_requested",
            EntityType = "User",
            EntityId = currentUser.UserId
        });
        await db.SaveChangesAsync();

        return Ok(new
        {
            message = "Data export request received. You will receive your data package via email within 30 days.",
            requestId = Guid.NewGuid()
        });
    }
}

public record RecordConsentRequest(string ConsentType, string Version, bool Granted, string? DocumentHash = null);
public record RevokeConsentRequest(string ConsentType, string Version);
public record SubmitReportRequest(string EntityType, Guid EntityId, string Reason, string? Description = null, string[]? EvidenceUrls = null);
