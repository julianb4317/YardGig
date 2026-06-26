using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class RecurringJobSeriesConfiguration : IEntityTypeConfiguration<RecurringJobSeries>
{
    public void Configure(EntityTypeBuilder<RecurringJobSeries> builder)
    {
        builder.ToTable("RecurringJobSeries");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Frequency).HasMaxLength(20).IsRequired();
        builder.Property(r => r.Time).HasMaxLength(10).IsRequired();

        builder.Property(r => r.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasOne(r => r.CustomerProfile)
            .WithMany()
            .HasForeignKey(r => r.CustomerProfileId);

        builder.HasOne(r => r.TemplateJob)
            .WithMany()
            .HasForeignKey(r => r.TemplateJobId);

        builder.HasOne(r => r.AssignedVendorProfile)
            .WithMany()
            .HasForeignKey(r => r.AssignedVendorProfileId)
            .IsRequired(false);

        builder.HasIndex(r => new { r.Status, r.NextOccurrence })
            .HasDatabaseName("idx_recurring_status_next");
    }
}
