using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class NotificationOutboxConfiguration : IEntityTypeConfiguration<NotificationOutboxEntry>
{
    public void Configure(EntityTypeBuilder<NotificationOutboxEntry> builder)
    {
        builder.ToTable("NotificationOutbox");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.EventType).HasMaxLength(50).IsRequired();
        builder.Property(e => e.Channel).HasMaxLength(10).IsRequired();
        builder.Property(e => e.PayloadJson).IsRequired();
        builder.Property(e => e.LastError).HasMaxLength(1000);
        builder.Property(e => e.ProviderMessageId).HasMaxLength(200);

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Index for outbox processing: pending entries ready for retry
        builder.HasIndex(e => new { e.Status, e.NextAttemptAt })
            .HasDatabaseName("idx_outbox_pending")
            .HasFilter("\"Status\" = 'Pending'");

        // Dead letter monitoring
        builder.HasIndex(e => new { e.Status, e.CreatedAt })
            .HasDatabaseName("idx_outbox_deadletter")
            .HasFilter("\"Status\" = 'DeadLetter'");
    }
}

public class NotificationPreferenceConfiguration : IEntityTypeConfiguration<NotificationPreference>
{
    public void Configure(EntityTypeBuilder<NotificationPreference> builder)
    {
        builder.ToTable("NotificationPreferences");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.EventType).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Channel).HasMaxLength(10).IsRequired();

        builder.HasIndex(p => new { p.UserId, p.EventType, p.Channel }).IsUnique();

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId);
    }
}

public class UserDeviceConfiguration : IEntityTypeConfiguration<UserDevice>
{
    public void Configure(EntityTypeBuilder<UserDevice> builder)
    {
        builder.ToTable("UserDevices");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Platform).HasMaxLength(20).IsRequired();
        builder.Property(d => d.Token).HasMaxLength(500).IsRequired();

        builder.HasIndex(d => new { d.UserId, d.IsActive })
            .HasDatabaseName("idx_device_user_active");

        builder.HasIndex(d => d.Token).IsUnique();

        builder.HasOne(d => d.User)
            .WithMany()
            .HasForeignKey(d => d.UserId);
    }
}

public class ScheduledNotificationConfiguration : IEntityTypeConfiguration<ScheduledNotification>
{
    public void Configure(EntityTypeBuilder<ScheduledNotification> builder)
    {
        builder.ToTable("ScheduledNotifications");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.EventType).HasMaxLength(50).IsRequired();
        builder.Property(s => s.VariablesJson).IsRequired();

        builder.HasIndex(s => new { s.IsProcessed, s.IsCancelled, s.ScheduledFor })
            .HasDatabaseName("idx_scheduled_pending")
            .HasFilter("\"IsProcessed\" = false AND \"IsCancelled\" = false");
    }
}
