using YardGig.Domain.Common;

namespace YardGig.Domain.Entities;

/// <summary>
/// Outbox pattern for reliable notification delivery.
/// Background worker processes pending entries with retry logic.
/// </summary>
public class NotificationOutboxEntry : BaseEntity
{
    public string EventType { get; set; } = string.Empty;
    public Guid RecipientUserId { get; set; }
    public string Channel { get; set; } = string.Empty; // email, push, sms, inapp
    public string PayloadJson { get; set; } = string.Empty;
    public NotificationDeliveryStatus Status { get; set; } = NotificationDeliveryStatus.Pending;
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public string? ProviderMessageId { get; set; }
    public DateTime? SentAt { get; set; }
}

public enum NotificationDeliveryStatus
{
    Pending,
    Processing,
    Sent,
    Failed,
    DeadLetter
}
