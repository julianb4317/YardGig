namespace YardGig.Domain.Entities;

/// <summary>
/// User opt-in/out preferences per event type and channel.
/// </summary>
public class NotificationPreference
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string EventType { get; set; } = string.Empty; // "vendor.requested" or "*"
    public string Channel { get; set; } = string.Empty;   // "email", "push", "sms"
    public bool Enabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
