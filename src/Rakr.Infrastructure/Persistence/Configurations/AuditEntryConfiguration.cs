using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("AuditEntries");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id).UseIdentityAlwaysColumn();
        builder.Property(a => a.Action).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityType).HasMaxLength(50);
        builder.Property(a => a.IpAddress).HasMaxLength(45);

        builder.HasIndex(a => a.CreatedAt)
            .HasDatabaseName("idx_audit_created")
            .IsDescending();

        builder.HasOne(a => a.Actor)
            .WithMany()
            .HasForeignKey(a => a.ActorId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
