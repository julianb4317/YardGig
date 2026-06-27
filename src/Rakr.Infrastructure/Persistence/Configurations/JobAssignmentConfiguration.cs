using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class JobAssignmentConfiguration : IEntityTypeConfiguration<JobAssignment>
{
    public void Configure(EntityTypeBuilder<JobAssignment> builder)
    {
        builder.ToTable("JobAssignments");
        builder.HasKey(ja => ja.Id);

        builder.HasIndex(ja => ja.JobRequestId).IsUnique();

        builder.HasOne(ja => ja.JobRequest)
            .WithOne(j => j.Assignment)
            .HasForeignKey<JobAssignment>(ja => ja.JobRequestId);

        builder.HasOne(ja => ja.VendorProfile)
            .WithMany(vp => vp.Assignments)
            .HasForeignKey(ja => ja.VendorProfileId);

        builder.HasOne(ja => ja.VendorRequest)
            .WithOne()
            .HasForeignKey<JobAssignment>(ja => ja.VendorRequestId);
    }
}
