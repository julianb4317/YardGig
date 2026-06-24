using Microsoft.EntityFrameworkCore;
using YardGig.Application.Notifications.Interfaces;
using YardGig.Infrastructure.Persistence;

namespace YardGig.Infrastructure.Notifications;

public class PreferenceService(AppDbContext db) : IPreferenceService
{
    /// <summary>
    /// Events that cannot be opted out of (security/legal).
    /// </summary>
    private static readonly HashSet<string> MandatoryEvents =
    [
        "account.password_reset",
        "account.suspended",
        "account.email_verified",
        "payment.failed",
        "dispute.opened"
    ];

    /// <summary>
    /// Default channels per event category when no user preference exists.
    /// </summary>
    private static readonly Dictionary<string, string[]> DefaultChannels = new()
    {
        // Job events → all channels
        ["job."] = ["email", "push", "inapp"],
        ["vendor."] = ["email", "push", "inapp"],
        // Payment events → email + inapp
        ["payment."] = ["email", "inapp"],
        ["payout."] = ["email", "inapp"],
        ["refund."] = ["email", "inapp"],
        // Account events → email + inapp
        ["account."] = ["email", "inapp"],
        // Engagement → push + inapp only
        ["rating."] = ["push", "inapp"],
        ["dispute."] = ["email", "inapp"],
        ["nudge."] = ["email", "push"],
    };

    public async Task<string[]> GetEnabledChannelsAsync(Guid userId, string eventType, CancellationToken ct = default)
    {
        // Mandatory events always send on their default channels
        if (IsMandatory(eventType))
        {
            return GetDefaultChannelsForEvent(eventType);
        }

        // Check user preferences
        var userPrefs = await db.Set<Domain.Entities.NotificationPreference>()
            .Where(p => p.UserId == userId &&
                (p.EventType == eventType || p.EventType == "*"))
            .ToListAsync(ct);

        if (userPrefs.Count == 0)
        {
            // No preferences set → use defaults
            return GetDefaultChannelsForEvent(eventType);
        }

        // Specific event prefs override wildcard
        var specificPrefs = userPrefs.Where(p => p.EventType == eventType).ToList();
        if (specificPrefs.Count > 0)
        {
            return specificPrefs.Where(p => p.Enabled).Select(p => p.Channel).ToArray();
        }

        // Wildcard preferences
        var wildcardPrefs = userPrefs.Where(p => p.EventType == "*").ToList();
        return wildcardPrefs.Where(p => p.Enabled).Select(p => p.Channel).ToArray();
    }

    public bool IsMandatory(string eventType) => MandatoryEvents.Contains(eventType);

    private static string[] GetDefaultChannelsForEvent(string eventType)
    {
        foreach (var (prefix, channels) in DefaultChannels)
        {
            if (eventType.StartsWith(prefix))
                return channels;
        }

        return ["inapp"]; // Fallback: always at least in-app
    }
}
