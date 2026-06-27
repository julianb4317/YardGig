using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class JobMessageConfiguration : IEntityTypeConfiguration<JobMessage>
{
    public void Configure(EntityTypeBuilder<JobMessage> builder)
    {
        builder.ToTable("JobMessages");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Body).IsRequired().HasMaxLength(2000);

        builder.HasIndex(m => new { m.JobRequestId, m.CreatedAt });

        builder.HasOne(m => m.JobRequest).WithMany().HasForeignKey(m => m.JobRequestId);
        builder.HasOne(m => m.Sender).WithMany().HasForeignKey(m => m.SenderUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
