using YardGig.Domain.Common;

namespace YardGig.Domain.Entities;

/// <summary>
/// Core user entity. ASP.NET Identity's IdentityUser is used in Infrastructure;
/// this is the domain representation.
/// </summary>
public class ApplicationUser : AggregateRoot
{
    public string Email { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public string? AuthProvider { get; set; } // local, google, apple
    public string? ExternalId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LockedUntil { get; set; }

    // Navigation
    public CustomerProfile? CustomerProfile { get; set; }
    public VendorProfile? VendorProfile { get; set; }
    public ICollection<UserRole> UserRoles { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
}
