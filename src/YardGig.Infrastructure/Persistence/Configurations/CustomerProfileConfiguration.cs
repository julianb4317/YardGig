using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class CustomerProfileConfiguration : IEntityTypeConfiguration<CustomerProfile>
{
    public void Configure(EntityTypeBuilder<CustomerProfile> builder)
    {
        builder.ToTable("CustomerProfiles");
        builder.HasKey(cp => cp.Id);

        builder.HasIndex(cp => cp.UserId).IsUnique();
        builder.Property(cp => cp.StripeCustomerId).HasMaxLength(100);

        builder.Property(cp => cp.DefaultLocation)
            .HasColumnType("geometry (point, 4326)");
    }
}
