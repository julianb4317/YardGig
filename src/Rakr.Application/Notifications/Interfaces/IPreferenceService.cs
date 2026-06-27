namespace Rakr.Application.Notifications.Interfaces;

/// <summary>
/// Resolves which channels are enabled for a user/event combination.
/// </summary>
public interface IPreferenceService
{
    /// <summary>
    /// Returns the list of enabled channels for a given user and event type.
    /// Respects user preferences and non-overridable events.
    /// </summary>
    Task<string[]> GetEnabledChannelsAsync(Guid userId, string eventType, CancellationToken ct = default);

    /// <summary>
    /// Returns true if this event type cannot be opted out of.
    /// </summary>
    bool IsMandatory(string eventType);
}
