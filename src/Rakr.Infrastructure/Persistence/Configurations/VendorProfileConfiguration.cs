using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class VendorProfileConfiguration : IEntityTypeConfiguration<VendorProfile>
{
    public void Configure(EntityTypeBuilder<VendorProfile> builder)
    {
        builder.ToTable("VendorProfiles");
        builder.HasKey(vp => vp.Id);

        builder.HasIndex(vp => vp.UserId).IsUnique();
        builder.Property(vp => vp.BusinessName).HasMaxLength(200);
        builder.Property(vp => vp.StripeAccountId).HasMaxLength(100);
        builder.Property(vp => vp.AverageRating).HasPrecision(3, 2);

        builder.Property(vp => vp.VerificationStatus)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(vp => vp.HomeLocation)
            .HasColumnType("geometry (point, 4326)");

        // PostGIS GiST index on vendor location
        builder.HasIndex(vp => vp.HomeLocation)
            .HasMethod("gist");
    }
}
