using System.Text.Json;
using Microsoft.Extensions.Logging;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;

namespace Rakr.Infrastructure.Services;

public class NotificationService(
    IAppDbContext db,
    ILogger<NotificationService> logger
) : INotificationService
{
    public Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        // TODO: Integrate with SendGrid or AWS SES
        logger.LogInformation("Email queued to {Email}: {Subject}", toEmail, subject);
        return Task.CompletedTask;
    }

    public async Task SendInAppNotificationAsync(
        Guid userId, string type, string title, string? body, object? metadata,
        CancellationToken cancellationToken = default)
    {
        var notification = new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Body = body,
            MetadataJson = metadata is not null ? JsonSerializer.Serialize(metadata) : null,
            Channel = NotificationChannel.InApp,
            SentAt = DateTime.UtcNow
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("In-app notification sent to {UserId}: {Type}", userId, type);
    }
}
