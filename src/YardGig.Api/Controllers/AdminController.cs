using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Domain.Entities;
using YardGig.Domain.Enums;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminController(IAppDbContext db, ICurrentUserService currentUser) : ControllerBase
{
    // ─────────────────── DASHBOARD ───────────────────

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var today = DateTime.UtcNow.Date;
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var jobsToday = await db.JobRequests.CountAsync(j => j.CreatedAt >= today);
        var activeVendors = await db.VendorProfiles.CountAsync(v => v.VerificationStatus == VerificationStatus.Approved);
        var openDisputes = await db.Disputes.CountAsync(d => d.Status == DisputeStatus.Open || d.Status == DisputeStatus.Investigating);
        var pendingVerifications = await db.VendorProfiles.CountAsync(v => v.VerificationStatus == VerificationStatus.Pending);
        var failedPayouts = await db.Payouts.CountAsync(p => p.Status == PayoutStatus.Failed);
        var newUsersToday = await db.Users.CountAsync(u => u.CreatedAt >= today);

        var revenueToday = await db.PlatformFeeLedgerEntries
            .Where(l => l.EntryType == "fee_earned" && l.CreatedAt >= today)
            .SumAsync(l => (int?)l.AmountCents) ?? 0;

        var revenueMtd = await db.PlatformFeeLedgerEntries
            .Where(l => l.EntryType == "fee_earned" && l.CreatedAt >= monthStart)
            .SumAsync(l => (int?)l.AmountCents) ?? 0;

        var completionRate = await CalculateCompletionRateAsync();
        var avgRating = await db.Ratings.AverageAsync(r => (double?)r.Score) ?? 0;

        return Ok(new
        {
            jobsCreatedToday = jobsToday,
            activeVendors,
            openDisputes,
            pendingVerifications,
            failedPayouts,
            newUsersToday,
            revenueTodayCents = revenueToday,
            revenueMtdCents = revenueMtd,
            completionRatePercent = completionRate,
            avgRating = Math.Round(avgRating, 2)
        });
    }

    [HttpGet("dashboard/trends")]
    public async Task<IActionResult> GetTrends([FromQuery] int days = 30)
    {
        days = Math.Min(days, 90);
        var since = DateTime.UtcNow.Date.AddDays(-days);

        var jobsByDay = await db.JobRequests
            .Where(j => j.CreatedAt >= since)
            .GroupBy(j => j.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .OrderBy(x => x.Date)
            .ToListAsync();

        var revenueByDay = await db.PlatformFeeLedgerEntries
            .Where(l => l.EntryType == "fee_earned" && l.CreatedAt >= since)
            .GroupBy(l => l.CreatedAt.Date)
            .Select(g => new { Date = g.Key, AmountCents = g.Sum(l => l.AmountCents) })
            .OrderBy(x => x.Date)
            .ToListAsync();

        return Ok(new { jobsByDay, revenueByDay });
    }

    // ─────────────────── USER MANAGEMENT ───────────────────

    [HttpGet("users")]
    public async Task<IActionResult> ListUsers(
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = db.Users.AsNoTracking().Include(u => u.UserRoles).ThenInclude(ur => ur.Role).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(u => u.Email.Contains(search) || u.DisplayName.Contains(search));

        if (isActive.HasValue)
            query = query.Where(u => u.IsActive == isActive.Value);

        var totalCount = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id, u.Email, u.DisplayName, u.IsActive, u.EmailVerified,
                Roles = u.UserRoles.Select(ur => ur.Role.Name).ToArray(),
                u.CreatedAt, u.LockedUntil
            })
            .ToListAsync();

        return Ok(new { users, totalCount, page, pageSize });
    }

    [HttpGet("users/{id:guid}")]
    public async Task<IActionResult> GetUserDetail(Guid id)
    {
        var user = await db.Users.AsNoTracking()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.CustomerProfile)
            .Include(u => u.VendorProfile)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user is null) return NotFound();

        var jobCount = user.CustomerProfile is not null
            ? await db.JobRequests.CountAsync(j => j.CustomerProfileId == user.CustomerProfile.Id)
            : 0;

        var disputeCount = await db.Disputes.CountAsync(d => d.RaisedById == id);
        var ratingAvg = await db.Ratings.Where(r => r.RevieweeId == id).AverageAsync(r => (double?)r.Score);

        return Ok(new
        {
            user.Id, user.Email, user.DisplayName, user.Phone, user.IsActive,
            user.EmailVerified, user.AuthProvider, user.CreatedAt, user.LockedUntil,
            Roles = user.UserRoles.Select(ur => ur.Role.Name),
            VendorProfile = user.VendorProfile is not null ? new
            {
                user.VendorProfile.Id, user.VendorProfile.BusinessName,
                user.VendorProfile.VerificationStatus, user.VendorProfile.AverageRating,
                user.VendorProfile.TotalJobsCompleted
            } : null,
            Statistics = new { jobCount, disputeCount, averageRating = ratingAvg }
        });
    }

    [HttpPut("users/{id:guid}/suspend")]
    public async Task<IActionResult> SuspendUser(Guid id, [FromBody] SuspendUserRequest request)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();

        var oldValues = new { user.IsActive, user.LockedUntil };
        user.IsActive = false;
        user.LockedUntil = request.Until;
        user.UpdatedAt = DateTime.UtcNow;

        await CreateAuditEntryAsync("user.suspended", "User", id, oldValues, new { request.Reason, request.Until });
        await db.SaveChangesAsync();
        return Ok(new { message = "User suspended." });
    }

    [HttpPut("users/{id:guid}/unsuspend")]
    public async Task<IActionResult> UnsuspendUser(Guid id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();

        user.IsActive = true;
        user.LockedUntil = null;
        user.UpdatedAt = DateTime.UtcNow;

        await CreateAuditEntryAsync("user.unsuspended", "User", id, null, null);
        await db.SaveChangesAsync();
        return Ok(new { message = "User reactivated." });
    }

    // ─────────────────── VENDOR VERIFICATION ───────────────────

    [HttpGet("vendors/pending")]
    public async Task<IActionResult> GetPendingVendors()
    {
        var vendors = await db.VendorProfiles
            .AsNoTracking()
            .Include(v => v.User)
            .Where(v => v.VerificationStatus == VerificationStatus.Pending)
            .OrderBy(v => v.CreatedAt)
            .Select(v => new
            {
                v.Id, v.User.DisplayName, v.User.Email,
                v.BusinessName, v.ServiceCategories, v.InsuranceDocUrl,
                v.CreatedAt, DaysPending = (DateTime.UtcNow - v.CreatedAt).Days
            })
            .ToListAsync();

        return Ok(vendors);
    }

    [HttpGet("vendors/{id:guid}")]
    public async Task<IActionResult> GetVendorDetail(Guid id)
    {
        var vendor = await db.VendorProfiles.AsNoTracking()
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (vendor is null) return NotFound();

        var completedJobs = await db.JobAssignments
            .CountAsync(ja => ja.VendorProfileId == id && ja.CompletedAt != null);

        return Ok(new
        {
            vendor.Id, vendor.User.Email, vendor.User.DisplayName,
            vendor.BusinessName, vendor.Bio, vendor.ServiceCategories,
            vendor.ServiceRadiusMiles, vendor.InsuranceDocUrl,
            vendor.VerificationStatus, vendor.StripeAccountId,
            vendor.AverageRating, vendor.TotalJobsCompleted,
            vendor.CreatedAt, completedJobs
        });
    }

    [HttpPut("vendors/{id:guid}/verify")]
    public async Task<IActionResult> VerifyVendor(Guid id, [FromBody] VerifyVendorRequest request)
    {
        var vendor = await db.VendorProfiles.FindAsync(id);
        if (vendor is null) return NotFound();

        var oldStatus = vendor.VerificationStatus;
        vendor.VerificationStatus = request.Approved ? VerificationStatus.Approved : VerificationStatus.Rejected;
        vendor.UpdatedAt = DateTime.UtcNow;

        await CreateAuditEntryAsync(
            request.Approved ? "vendor.approved" : "vendor.rejected",
            "VendorProfile", id,
            new { Status = oldStatus.ToString() },
            new { Status = vendor.VerificationStatus.ToString(), request.Reason });

        await db.SaveChangesAsync();
        return Ok(new { message = request.Approved ? "Vendor approved." : "Vendor rejected." });
    }

    // ─────────────────── JOB MODERATION ───────────────────

    [HttpGet("jobs")]
    public async Task<IActionResult> ListJobs(
        [FromQuery] string? status = null,
        [FromQuery] string? category = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = db.JobRequests.AsNoTracking().Include(j => j.CustomerProfile).ThenInclude(cp => cp.User).AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<JobStatus>(status, true, out var s))
            query = query.Where(j => j.Status == s);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(j => j.Categories.Contains(category));

        var totalCount = await query.CountAsync();

        var jobs = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(j => new
            {
                j.Id, j.Title, j.Status, j.Categories, j.BudgetCents,
                CustomerEmail = j.CustomerProfile.User.Email,
                j.CreatedAt, j.ExpiresAt
            })
            .ToListAsync();

        return Ok(new { jobs, totalCount, page, pageSize });
    }

    [HttpPut("jobs/{id:guid}/hide")]
    public async Task<IActionResult> HideJob(Guid id, [FromBody] HideJobRequest request)
    {
        var job = await db.JobRequests.FindAsync(id);
        if (job is null) return NotFound();

        var oldStatus = job.Status;
        job.Status = JobStatus.Cancelled;
        job.UpdatedAt = DateTime.UtcNow;

        await CreateAuditEntryAsync("job.hidden", "JobRequest", id,
            new { Status = oldStatus.ToString() },
            new { request.Reason, NewStatus = "Cancelled" });

        await db.SaveChangesAsync();
        return Ok(new { message = "Job hidden." });
    }

    [HttpPut("jobs/{id:guid}/cancel")]
    public async Task<IActionResult> ForceCancel(Guid id, [FromBody] ForceCancelRequest request)
    {
        var job = await db.JobRequests.FindAsync(id);
        if (job is null) return NotFound();

        var oldStatus = job.Status;
        job.Status = JobStatus.Cancelled;
        job.UpdatedAt = DateTime.UtcNow;

        await CreateAuditEntryAsync("job.force_cancelled", "JobRequest", id,
            new { Status = oldStatus.ToString() },
            new { request.Reason });

        await db.SaveChangesAsync();
        return Ok(new { message = "Job force-cancelled." });
    }

    // ─────────────────── DISPUTES ───────────────────

    [HttpGet("disputes")]
    public async Task<IActionResult> GetDisputes([FromQuery] string? status = null)
    {
        var query = db.Disputes.AsNoTracking()
            .Include(d => d.RaisedBy)
            .Include(d => d.JobRequest)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DisputeStatus>(status, true, out var s))
            query = query.Where(d => d.Status == s);
        else
            query = query.Where(d => d.Status == DisputeStatus.Open || d.Status == DisputeStatus.Investigating);

        var disputes = await query
            .OrderBy(d => d.CreatedAt)
            .Select(d => new
            {
                d.Id, d.JobRequestId, JobTitle = d.JobRequest.Title,
                RaisedBy = d.RaisedBy.DisplayName, RaisedByEmail = d.RaisedBy.Email,
                d.Reason, d.Status, d.CreatedAt,
                AgeDays = (DateTime.UtcNow - d.CreatedAt).Days
            })
            .ToListAsync();

        return Ok(disputes);
    }

    [HttpGet("disputes/{id:guid}")]
    public async Task<IActionResult> GetDisputeDetail(Guid id)
    {
        var dispute = await db.Disputes.AsNoTracking()
            .Include(d => d.RaisedBy)
            .Include(d => d.ResolvedBy)
            .Include(d => d.JobRequest).ThenInclude(j => j.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(d => d.JobRequest).ThenInclude(j => j.Assignment!).ThenInclude(a => a.VendorProfile).ThenInclude(vp => vp.User)
            .Include(d => d.Notes).ThenInclude(n => n.Author)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (dispute is null) return NotFound();

        return Ok(new
        {
            dispute.Id, dispute.JobRequestId,
            Job = new { dispute.JobRequest.Title, dispute.JobRequest.BudgetCents, dispute.JobRequest.Status },
            Customer = new { dispute.JobRequest.CustomerProfile.User.Email, dispute.JobRequest.CustomerProfile.User.DisplayName },
            Vendor = dispute.JobRequest.Assignment != null ? new
            {
                dispute.JobRequest.Assignment.VendorProfile.User.Email,
                dispute.JobRequest.Assignment.VendorProfile.User.DisplayName
            } : null,
            dispute.Reason, dispute.Status, dispute.Resolution,
            ResolvedBy = dispute.ResolvedBy?.DisplayName,
            dispute.ResolvedAt, dispute.CreatedAt,
            Notes = dispute.Notes.OrderBy(n => n.CreatedAt).Select(n => new
            {
                n.Id, Author = n.Author.DisplayName, n.Body, n.CreatedAt
            })
        });
    }

    [HttpPut("disputes/{id:guid}/resolve")]
    public async Task<IActionResult> ResolveDispute(Guid id, [FromBody] ResolveDisputeRequest request)
    {
        var dispute = await db.Disputes.FindAsync(id);
        if (dispute is null) return NotFound();

        dispute.Status = DisputeStatus.Resolved;
        dispute.Resolution = request.Resolution;
        dispute.ResolvedById = currentUser.UserId;
        dispute.ResolvedAt = DateTime.UtcNow;

        await CreateAuditEntryAsync("dispute.resolved", "Dispute", id, null,
            new { request.Resolution, request.Action });

        await db.SaveChangesAsync();
        return Ok(new { message = "Dispute resolved." });
    }

    [HttpPost("disputes/{id:guid}/notes")]
    public async Task<IActionResult> AddDisputeNote(Guid id, [FromBody] AddNoteRequest request)
    {
        var dispute = await db.Disputes.FindAsync(id);
        if (dispute is null) return NotFound();

        var note = new DisputeNote
        {
            DisputeId = id,
            AuthorId = currentUser.UserId!.Value,
            Body = request.Body
        };
        db.DisputeNotes.Add(note);

        await CreateAuditEntryAsync("dispute.note_added", "Dispute", id, null, new { NoteLength = request.Body.Length });
        await db.SaveChangesAsync();

        return Ok(new { noteId = note.Id });
    }

    // ─────────────────── FINANCE ───────────────────

    [HttpGet("finance/revenue")]
    public async Task<IActionResult> GetRevenue(
        [FromQuery] string period = "monthly",
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var startDate = from ?? DateTime.UtcNow.AddMonths(-6);
        var endDate = to ?? DateTime.UtcNow;

        var totalGross = await db.PaymentTransactions
            .Where(pt => pt.Status == PaymentStatus.Captured && pt.CreatedAt >= startDate && pt.CreatedAt <= endDate)
            .SumAsync(pt => (int?)pt.AmountCents) ?? 0;

        var totalFees = await db.PlatformFeeLedgerEntries
            .Where(l => l.EntryType == "fee_earned" && l.CreatedAt >= startDate && l.CreatedAt <= endDate)
            .SumAsync(l => (int?)l.AmountCents) ?? 0;

        var totalPayouts = await db.Payouts
            .Where(p => p.Status == PayoutStatus.Paid && p.CreatedAt >= startDate && p.CreatedAt <= endDate)
            .SumAsync(p => (int?)p.AmountCents) ?? 0;

        var jobCount = await db.PaymentTransactions
            .CountAsync(pt => pt.Status == PaymentStatus.Captured && pt.CreatedAt >= startDate && pt.CreatedAt <= endDate);

        return Ok(new
        {
            summary = new { totalGrossCents = totalGross, totalPlatformFeeCents = totalFees, totalPayoutsCents = totalPayouts, jobCount },
            period, from = startDate, to = endDate
        });
    }

    [HttpGet("finance/payouts")]
    public async Task<IActionResult> GetPayouts(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = db.Payouts.AsNoTracking()
            .Include(p => p.VendorProfile).ThenInclude(vp => vp.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PayoutStatus>(status, true, out var s))
            query = query.Where(p => p.Status == s);

        var totalCount = await query.CountAsync();

        var payouts = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id, VendorName = p.VendorProfile.User.DisplayName,
                VendorEmail = p.VendorProfile.User.Email,
                p.AmountCents, p.Status, p.StripeTransferId,
                p.PaidAt, p.CreatedAt
            })
            .ToListAsync();

        return Ok(new { payouts, totalCount, page, pageSize });
    }

    [HttpPut("finance/payouts/{id:guid}/retry")]
    public async Task<IActionResult> RetryPayout(Guid id)
    {
        var payout = await db.Payouts.FindAsync(id);
        if (payout is null) return NotFound();
        if (payout.Status != PayoutStatus.Failed) return BadRequest("Only failed payouts can be retried.");

        payout.Status = PayoutStatus.Pending;

        await CreateAuditEntryAsync("payout.manual_retry", "Payout", id, null, null);
        await db.SaveChangesAsync();

        return Ok(new { message = "Payout queued for retry." });
    }

    [HttpGet("finance/commissions")]
    public async Task<IActionResult> GetCommissions()
    {
        var configs = await db.CommissionConfigs
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Scope)
            .ThenBy(c => c.ScopeKey)
            .ToListAsync();

        return Ok(configs);
    }

    [HttpPost("finance/commissions")]
    public async Task<IActionResult> CreateCommission([FromBody] CreateCommissionRequest request)
    {
        var config = new CommissionConfig
        {
            Scope = request.Scope,
            ScopeKey = request.ScopeKey,
            Rate = request.Rate,
            EffectiveFrom = request.EffectiveFrom ?? DateTime.UtcNow,
            EffectiveTo = request.EffectiveTo,
            IsActive = true
        };

        db.CommissionConfigs.Add(config);

        await CreateAuditEntryAsync("commission.created", "CommissionConfig", config.Id, null,
            new { request.Scope, request.ScopeKey, request.Rate });

        await db.SaveChangesAsync();
        return Ok(new { id = config.Id });
    }

    [HttpPut("finance/commissions/{id:guid}")]
    public async Task<IActionResult> DeactivateCommission(Guid id)
    {
        var config = await db.CommissionConfigs.FindAsync(id);
        if (config is null) return NotFound();

        config.IsActive = false;
        config.EffectiveTo = DateTime.UtcNow;

        await CreateAuditEntryAsync("commission.deactivated", "CommissionConfig", id, null, null);
        await db.SaveChangesAsync();

        return Ok(new { message = "Commission rate deactivated." });
    }

    // ─────────────────── AUDIT LOG ───────────────────

    [HttpGet("audit")]
    public async Task<IActionResult> GetAuditLog(
        [FromQuery] Guid? actorId = null,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? entityId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = db.AuditEntries.AsNoTracking()
            .Include(a => a.Actor)
            .AsQueryable();

        if (actorId.HasValue) query = query.Where(a => a.ActorId == actorId);
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action.Contains(action));
        if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(a => a.EntityType == entityType);
        if (entityId.HasValue) query = query.Where(a => a.EntityId == entityId);
        if (from.HasValue) query = query.Where(a => a.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(a => a.CreatedAt <= to.Value);

        var totalCount = await query.CountAsync();

        var entries = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                ActorEmail = a.Actor != null ? a.Actor.Email : "system",
                a.Action, a.EntityType, a.EntityId,
                a.OldValuesJson, a.NewValuesJson,
                a.IpAddress, a.CreatedAt
            })
            .ToListAsync();

        return Ok(new { entries, totalCount, page, pageSize });
    }

    // ─────────────────── HELPERS ───────────────────

    private Task CreateAuditEntryAsync(string action, string? entityType, Guid? entityId, object? oldValues, object? newValues)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        db.AuditEntries.Add(new AuditEntry
        {
            ActorId = currentUser.UserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValuesJson = oldValues is not null ? JsonSerializer.Serialize(oldValues) : null,
            NewValuesJson = newValues is not null ? JsonSerializer.Serialize(newValues) : null,
            IpAddress = ipAddress
        });

        return Task.CompletedTask;
    }

    private async Task<double> CalculateCompletionRateAsync()
    {
        var terminalStatuses = new[] { JobStatus.Paid, JobStatus.Closed };
        var allRelevant = await db.JobRequests.CountAsync(j =>
            j.Status == JobStatus.Assigned || j.Status == JobStatus.InProgress ||
            j.Status == JobStatus.Completed || j.Status == JobStatus.Paid || j.Status == JobStatus.Closed);

        if (allRelevant == 0) return 0;

        var completed = await db.JobRequests.CountAsync(j => terminalStatuses.Contains(j.Status));
        return Math.Round((double)completed / allRelevant * 100, 1);
    }
}

// Request DTOs
public record VerifyVendorRequest(bool Approved, string? Reason = null);
public record ResolveDisputeRequest(string Resolution, string? Action = null);
public record SuspendUserRequest(string Reason, DateTime? Until);
public record HideJobRequest(string Reason);
public record ForceCancelRequest(string Reason);
public record AddNoteRequest(string Body);
public record CreateCommissionRequest(string Scope, string? ScopeKey, decimal Rate, DateTime? EffectiveFrom, DateTime? EffectiveTo);
