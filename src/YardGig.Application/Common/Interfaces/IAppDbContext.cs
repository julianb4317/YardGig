using Microsoft.EntityFrameworkCore;
using YardGig.Domain.Entities;

namespace YardGig.Application.Common.Interfaces;

public interface IAppDbContext
{
    DbSet<ApplicationUser> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<CustomerProfile> CustomerProfiles { get; }
    DbSet<VendorProfile> VendorProfiles { get; }
    DbSet<JobRequest> JobRequests { get; }
    DbSet<VendorRequest> VendorRequests { get; }
    DbSet<JobAssignment> JobAssignments { get; }
    DbSet<PaymentTransaction> PaymentTransactions { get; }
    DbSet<Payout> Payouts { get; }
    DbSet<PlatformFeeLedger> PlatformFeeLedgerEntries { get; }
    DbSet<Rating> Ratings { get; }
    DbSet<Dispute> Disputes { get; }
    DbSet<DisputeNote> DisputeNotes { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<AuditEntry> AuditEntries { get; }
    DbSet<LedgerEntry> LedgerEntries { get; }
    DbSet<CommissionConfig> CommissionConfigs { get; }
    DbSet<ProcessedWebhookEvent> ProcessedWebhookEvents { get; }
    DbSet<NotificationOutboxEntry> NotificationOutbox { get; }
    DbSet<NotificationPreference> NotificationPreferences { get; }
    DbSet<UserDevice> UserDevices { get; }
    DbSet<ScheduledNotification> ScheduledNotifications { get; }
    DbSet<ConsentRecord> ConsentRecords { get; }
    DbSet<AbuseReport> AbuseReports { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
