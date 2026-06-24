using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class ConsentRecordConfiguration : IEntityTypeConfiguration<ConsentRecord>
{
    public void Configure(EntityTypeBuilder<ConsentRecord> builder)
    {
        builder.ToTable("ConsentRecords");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ConsentType).HasMaxLength(50).IsRequired();
        builder.Property(c => c.Version).HasMaxLength(20).IsRequired();
        builder.Property(c => c.IpAddress).HasMaxLength(45);
        builder.Property(c => c.UserAgent).HasMaxLength(500);
        builder.Property(c => c.DocumentHash).HasMaxLength(64);

        builder.HasIndex(c => new { c.UserId, c.ConsentType, c.ConsentedAt })
            .HasDatabaseName("idx_consent_user_type");

        builder.HasOne(c => c.User)
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class AbuseReportConfiguration : IEntityTypeConfiguration<AbuseReport>
{
    public void Configure(EntityTypeBuilder<AbuseReport> builder)
    {
        builder.ToTable("AbuseReports");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.EntityType).HasMaxLength(50).IsRequired();
        builder.Property(r => r.Reason).HasMaxLength(50).IsRequired();
        builder.Property(r => r.Description).HasMaxLength(2000);
        builder.Property(r => r.Status).HasMaxLength(20).IsRequired();
        builder.Property(r => r.Resolution).HasMaxLength(1000);

        builder.HasIndex(r => new { r.Status, r.CreatedAt })
            .HasDatabaseName("idx_report_status")
            .HasFilter("\"Status\" IN ('open', 'investigating')");

        builder.HasOne(r => r.Reporter)
            .WithMany()
            .HasForeignKey(r => r.ReporterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.ResolvedBy)
            .WithMany()
            .HasForeignKey(r => r.ResolvedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
