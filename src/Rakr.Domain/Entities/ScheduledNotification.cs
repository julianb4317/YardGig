namespace Rakr.Domain.Entities;

/// <summary>
/// Delayed/scheduled notifications (nudges, reminders).
/// Background job processes these when ScheduledFor <= now.
/// </summary>
public class ScheduledNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EventType { get; set; } = string.Empty;
    public Guid RecipientUserId { get; set; }
    public string VariablesJson { get; set; } = "{}";
    public DateTime ScheduledFor { get; set; }
    public bool IsCancelled { get; set; }
    public bool IsProcessed { get; set; }
    public Guid? CancelledByEventId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
