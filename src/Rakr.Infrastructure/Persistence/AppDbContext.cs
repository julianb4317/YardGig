using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly IMediator? _mediator;

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public AppDbContext(DbContextOptions<AppDbContext> options, IMediator mediator) : base(options)
    {
        _mediator = mediator;
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var result = await base.SaveChangesAsync(cancellationToken);

        if (_mediator is not null)
        {
            await this.DispatchDomainEventsAsync(_mediator);
        }

        return result;
    }

    public DbSet<ApplicationUser> Users => Set<ApplicationUser>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();
    public DbSet<VendorProfile> VendorProfiles => Set<VendorProfile>();
    public DbSet<JobRequest> JobRequests => Set<JobRequest>();
    public DbSet<VendorRequest> VendorRequests => Set<VendorRequest>();
    public DbSet<JobAssignment> JobAssignments => Set<JobAssignment>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<Payout> Payouts => Set<Payout>();
    public DbSet<PlatformFeeLedger> PlatformFeeLedgerEntries => Set<PlatformFeeLedger>();
    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<Dispute> Disputes => Set<Dispute>();
    public DbSet<DisputeNote> DisputeNotes => Set<DisputeNote>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<CommissionConfig> CommissionConfigs => Set<CommissionConfig>();
    public DbSet<ProcessedWebhookEvent> ProcessedWebhookEvents => Set<ProcessedWebhookEvent>();
    public DbSet<NotificationOutboxEntry> NotificationOutbox => Set<NotificationOutboxEntry>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<UserDevice> UserDevices => Set<UserDevice>();
    public DbSet<ScheduledNotification> ScheduledNotifications => Set<ScheduledNotification>();
    public DbSet<ConsentRecord> ConsentRecords => Set<ConsentRecord>();
    public DbSet<AbuseReport> AbuseReports => Set<AbuseReport>();
    public DbSet<VendorBalance> VendorBalances => Set<VendorBalance>();
    public DbSet<CustomerPaymentMethod> CustomerPaymentMethods => Set<CustomerPaymentMethod>();
    public DbSet<EscrowTransaction> EscrowTransactions => Set<EscrowTransaction>();
    public DbSet<JobMessage> JobMessages => Set<JobMessage>();
    public DbSet<RecurringJobSeries> RecurringJobSeries => Set<RecurringJobSeries>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);
        optionsBuilder.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
