using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class DisputeMessageConfiguration : IEntityTypeConfiguration<DisputeMessage>
{
    public void Configure(EntityTypeBuilder<DisputeMessage> builder)
    {
        builder.ToTable("DisputeMessages");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Body).IsRequired();

        builder.HasOne(m => m.Dispute).WithMany(d => d.Messages).HasForeignKey(m => m.DisputeId);
        builder.HasOne(m => m.Sender).WithMany().HasForeignKey(m => m.SenderUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
