using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.Phone).HasMaxLength(20);
        builder.Property(u => u.AuthProvider).HasMaxLength(50);
        builder.Property(u => u.ExternalId).HasMaxLength(256);

        builder.HasOne(u => u.CustomerProfile)
            .WithOne(cp => cp.User)
            .HasForeignKey<CustomerProfile>(cp => cp.UserId);

        builder.HasOne(u => u.VendorProfile)
            .WithOne(vp => vp.User)
            .HasForeignKey<VendorProfile>(vp => vp.UserId);

        builder.Ignore(u => u.DomainEvents);
    }
}
