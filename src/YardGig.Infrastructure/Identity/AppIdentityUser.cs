using Microsoft.AspNetCore.Identity;

namespace YardGig.Infrastructure.Identity;

/// <summary>
/// ASP.NET Core Identity user mapped to our domain's ApplicationUser.
/// Identity handles password hashing, lockout, MFA, email confirmation, and external logins.
/// </summary>
public class AppIdentityUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
