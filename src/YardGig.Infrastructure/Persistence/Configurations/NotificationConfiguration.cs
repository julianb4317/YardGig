using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Type).HasMaxLength(50).IsRequired();
        builder.Property(n => n.Title).HasMaxLength(200).IsRequired();

        builder.Property(n => n.Channel)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Unread notifications per user
        builder.HasIndex(n => new { n.UserId, n.CreatedAt })
            .HasDatabaseName("idx_notification_user_unread")
            .HasFilter("\"IsRead\" = false");

        builder.HasOne(n => n.User)
            .WithMany(u => u.Notifications)
            .HasForeignKey(n => n.UserId);
    }
}
