namespace YardGig.Domain.Entities;

/// <summary>
/// Push notification device tokens (FCM / APNs).
/// </summary>
public class UserDevice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Platform { get; set; } = string.Empty; // web, ios, android
    public string Token { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
