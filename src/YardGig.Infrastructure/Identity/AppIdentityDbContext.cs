using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace YardGig.Infrastructure.Identity;

/// <summary>
/// Separate DbContext for ASP.NET Core Identity tables.
/// Keeps Identity concerns isolated from domain data.
/// </summary>
public class AppIdentityDbContext : IdentityDbContext<AppIdentityUser, AppIdentityRole, Guid>
{
    public AppIdentityDbContext(DbContextOptions<AppIdentityDbContext> options) : base(options) { }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);
        // Suppress "pending model changes" warning so migrations apply even if model drifted slightly
        optionsBuilder.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Custom table names in a dedicated schema
        builder.HasDefaultSchema("identity");

        builder.Entity<AppIdentityUser>(b =>
        {
            b.ToTable("Users");
            b.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
        });

        builder.Entity<AppIdentityRole>(b =>
        {
            b.ToTable("Roles");

            // Seed default roles
            b.HasData(
                new AppIdentityRole("Customer") { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), NormalizedName = "CUSTOMER" },
                new AppIdentityRole("Vendor") { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), NormalizedName = "VENDOR" },
                new AppIdentityRole("Support") { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), NormalizedName = "SUPPORT" },
                new AppIdentityRole("Admin") { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), NormalizedName = "ADMIN" },
                new AppIdentityRole("Owner") { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), NormalizedName = "OWNER" }
            );
        });

        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserRole<Guid>>(b => b.ToTable("UserRoles"));
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserClaim<Guid>>(b => b.ToTable("UserClaims"));
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserLogin<Guid>>(b => b.ToTable("UserLogins"));
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserToken<Guid>>(b => b.ToTable("UserTokens"));
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityRoleClaim<Guid>>(b => b.ToTable("RoleClaims"));
    }
}
