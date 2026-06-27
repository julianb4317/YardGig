using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class VendorRequestConfiguration : IEntityTypeConfiguration<VendorRequest>
{
    public void Configure(EntityTypeBuilder<VendorRequest> builder)
    {
        builder.ToTable("VendorRequests");
        builder.HasKey(vr => vr.Id);

        builder.Property(vr => vr.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Unique constraint: one request per vendor per job
        builder.HasIndex(vr => new { vr.JobRequestId, vr.VendorProfileId })
            .IsUnique();

        builder.HasIndex(vr => new { vr.JobRequestId, vr.Status })
            .HasDatabaseName("idx_vendorrequest_job");

        builder.HasIndex(vr => new { vr.VendorProfileId, vr.CreatedAt })
            .HasDatabaseName("idx_vendorrequest_vendor");

        builder.HasOne(vr => vr.JobRequest)
            .WithMany(j => j.VendorRequests)
            .HasForeignKey(vr => vr.JobRequestId);

        builder.HasOne(vr => vr.VendorProfile)
            .WithMany(vp => vp.VendorRequests)
            .HasForeignKey(vr => vr.VendorProfileId);
    }
}
