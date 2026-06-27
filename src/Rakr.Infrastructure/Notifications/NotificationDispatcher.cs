using System.Text.Json;
using Microsoft.Extensions.Logging;
using Rakr.Application.Notifications.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Infrastructure.Persistence;

namespace Rakr.Infrastructure.Notifications;

/// <summary>
/// Orchestrates notification delivery: resolves preferences, renders templates,
/// and queues outbox entries for background processing.
/// </summary>
public class NotificationDispatcher(
    AppDbContext db,
    IPreferenceService preferences,
    ITemplateRenderer templateRenderer,
    ILogger<NotificationDispatcher> logger
) : INotificationDispatcher
{
    public async Task DispatchAsync(NotificationEvent evt, CancellationToken ct = default)
    {
        foreach (var recipientId in evt.RecipientUserIds)
        {
            try
            {
                var channels = await preferences.GetEnabledChannelsAsync(recipientId, evt.EventType, ct);

                foreach (var channel in channels)
                {
                    var rendered = await templateRenderer.RenderAsync(evt.EventType, channel, evt.Variables, ct);

                    var payload = JsonSerializer.Serialize(new
                    {
                        subject = rendered.Subject,
                        htmlBody = rendered.HtmlBody,
                        plainTextBody = rendered.PlainTextBody,
                        variables = evt.Variables
                    });

                    var outboxEntry = new NotificationOutboxEntry
                    {
                        EventType = evt.EventType,
                        RecipientUserId = recipientId,
                        Channel = channel,
                        PayloadJson = payload,
                        Status = NotificationDeliveryStatus.Pending,
                        AttemptCount = 0,
                        NextAttemptAt = DateTime.UtcNow
                    };

                    db.Set<NotificationOutboxEntry>().Add(outboxEntry);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to dispatch notification {EventType} to user {UserId}",
                    evt.EventType, recipientId);
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
