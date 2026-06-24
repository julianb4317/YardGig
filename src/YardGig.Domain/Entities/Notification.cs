using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public string Type { get; set; } = string.Empty; // vendor_requested, job_assigned, etc.
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? MetadataJson { get; set; } // JSON payload
    public bool IsRead { get; set; }
    public NotificationChannel Channel { get; set; } = NotificationChannel.Email;
    public DateTime? SentAt { get; set; }

    // Navigation
    public ApplicationUser User { get; set; } = null!;
}
