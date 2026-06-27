using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;

namespace Rakr.Infrastructure.Services;

/// <summary>
/// Centralized job workflow notifications.
/// Called from controllers after successful actions.
/// </summary>
public class JobNotifications(IAppDbContext db, INotificationService notifications)
{
    public async Task NotifyJobRequested(Guid jobId, Guid vendorProfileId, CancellationToken ct = default)
    {
        var job = await db.JobRequests.Include(j => j.CustomerProfile).FirstOrDefaultAsync(j => j.Id == jobId, ct);
        var vendor = await db.VendorProfiles.Include(v => v.User).FirstOrDefaultAsync(v => v.Id == vendorProfileId, ct);
        if (job?.CustomerProfile == null || vendor == null) return;

        // Send to the CUSTOMER (job owner), not the vendor
        var customerUserId = job.CustomerProfile.UserId;
        var vendorName = vendor.BusinessName ?? vendor.User?.DisplayName ?? "A vendor";
        
        // Don't notify yourself
        if (customerUserId == vendor.UserId) return;
        
        await notifications.SendInAppNotificationAsync(
            customerUserId, "job_requested",
            $"New request for \"{job.Title}\"",
            $"{vendorName} wants to do your job.",
            new { jobId }, ct);
    }

    public async Task NotifyJobAssigned(Guid jobId, Guid vendorProfileId, CancellationToken ct = default)
    {
        var vendor = await db.VendorProfiles.FirstOrDefaultAsync(v => v.Id == vendorProfileId, ct);
        if (vendor == null) return;

        await notifications.SendInAppNotificationAsync(
            vendor.UserId, "job_assigned",
            "You've been assigned a job! 🎉",
            "A customer accepted your request. Check job details for next steps.",
            new { jobId }, ct);
    }

    public async Task NotifyJobStarted(Guid jobId, CancellationToken ct = default)
    {
        var job = await db.JobRequests.Include(j => j.CustomerProfile).FirstOrDefaultAsync(j => j.Id == jobId, ct);
        if (job?.CustomerProfile == null) return;

        await notifications.SendInAppNotificationAsync(
            job.CustomerProfile.UserId, "job_started",
            $"Work started on \"{job.Title}\"",
            "Your vendor has begun working on the job.",
            new { jobId }, ct);
    }

    public async Task NotifyJobCompleted(Guid jobId, CancellationToken ct = default)
    {
        var job = await db.JobRequests.Include(j => j.CustomerProfile).FirstOrDefaultAsync(j => j.Id == jobId, ct);
        if (job?.CustomerProfile == null) return;

        await notifications.SendInAppNotificationAsync(
            job.CustomerProfile.UserId, "job_completed",
            $"Work completed on \"{job.Title}\"",
            "Your vendor has marked the job as done. Review completion photos and release payment.",
            new { jobId }, ct);
    }

    public async Task NotifyPaymentReleased(Guid jobId, Guid vendorUserId, int amountCents, CancellationToken ct = default)
    {
        var job = await db.JobRequests.FirstOrDefaultAsync(j => j.Id == jobId, ct);

        await notifications.SendInAppNotificationAsync(
            vendorUserId, "payment_released",
            $"Payment received: ${amountCents / 100.0:F2}",
            $"Payment for \"{job?.Title ?? "job"}\" has been released to your balance.",
            new { jobId, amountCents }, ct);
    }

    public async Task NotifyVendorRejected(Guid vendorProfileId, Guid jobId, CancellationToken ct = default)
    {
        var vendor = await db.VendorProfiles.FirstOrDefaultAsync(v => v.Id == vendorProfileId, ct);
        var job = await db.JobRequests.FirstOrDefaultAsync(j => j.Id == jobId, ct);
        if (vendor == null) return;

        await notifications.SendInAppNotificationAsync(
            vendor.UserId, "request_rejected",
            "Job request not selected",
            $"The customer chose a different vendor for \"{job?.Title ?? "a job"}\".",
            new { jobId }, ct);
    }

    public async Task NotifyVendorWithdrew(Guid jobId, Guid customerUserId, string jobTitle, CancellationToken ct = default)
    {
        await notifications.SendInAppNotificationAsync(
            customerUserId, "vendor_withdrew",
            "Vendor withdrew from your job",
            $"A vendor has withdrawn from \"{jobTitle}\". The job may be re-opened for new requests.",
            new { jobId }, ct);
    }

    public async Task NotifyJobCancelled(Guid jobId, Guid vendorUserId, string jobTitle, CancellationToken ct = default)
    {
        await notifications.SendInAppNotificationAsync(
            vendorUserId, "job_cancelled",
            "Job cancelled by customer",
            $"The job \"{jobTitle}\" has been cancelled.",
            new { jobId }, ct);
    }

    public async Task NotifyJobRescheduled(Guid jobId, Guid vendorUserId, string jobTitle, CancellationToken ct = default)
    {
        await notifications.SendInAppNotificationAsync(
            vendorUserId, "job_rescheduled",
            "Job schedule changed",
            $"The schedule for \"{jobTitle}\" has been updated. You can withdraw if the new time doesn't work.",
            new { jobId }, ct);
    }
}
