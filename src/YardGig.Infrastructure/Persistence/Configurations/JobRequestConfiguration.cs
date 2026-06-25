using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class JobRequestConfiguration : IEntityTypeConfiguration<JobRequest>
{
    public void Configure(EntityTypeBuilder<JobRequest> builder)
    {
        builder.ToTable("JobRequests");
        builder.HasKey(j => j.Id);

        builder.Property(j => j.Title).HasMaxLength(200).IsRequired();
        builder.Property(j => j.Description).IsRequired();
        builder.Property(j => j.Address).IsRequired();

        builder.Property(j => j.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(j => j.Location)
            .HasColumnType("geometry (point, 4326)")
            .IsRequired();

        // Partial index: open jobs by creation date
        builder.HasIndex(j => new { j.Status, j.CreatedAt })
            .HasDatabaseName("idx_jobrequest_status_created")
            .HasFilter("\"Status\" = 'Open'");

        // GiST index for geospatial queries
        builder.HasIndex(j => j.Location)
            .HasDatabaseName("idx_jobrequest_location_gist")
            .HasMethod("gist");

        // Customer's jobs index
        builder.HasIndex(j => new { j.CustomerProfileId, j.CreatedAt })
            .HasDatabaseName("idx_jobrequest_customer");

        builder.HasOne(j => j.CustomerProfile)
            .WithMany(cp => cp.JobRequests)
            .HasForeignKey(j => j.CustomerProfileId);

        builder.Ignore(j => j.DomainEvents);
    }
}
