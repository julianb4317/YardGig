namespace Rakr.Application.Notifications.Interfaces;

/// <summary>
/// Core orchestrator — resolves channels, applies preferences, queues delivery.
/// </summary>
public interface INotificationDispatcher
{
    Task DispatchAsync(NotificationEvent evt, CancellationToken ct = default);
}

/// <summary>
/// Event payload for the notification system.
/// </summary>
public record NotificationEvent(
    string EventType,
    Guid[] RecipientUserIds,
    Dictionary<string, object> Variables,
    NotificationPriority Priority = NotificationPriority.Normal
);

public enum NotificationPriority { Low, Normal, High, Critical }
