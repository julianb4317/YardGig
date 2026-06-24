using Microsoft.Extensions.Logging;
using YardGig.Application.Notifications.Interfaces;

namespace YardGig.Infrastructure.Notifications;

/// <summary>
/// Development email provider that logs messages instead of sending.
/// Replace with SendGridEmailProvider in production.
/// </summary>
public class LogEmailProvider(ILogger<LogEmailProvider> logger) : IEmailProvider
{
    public Task<DeliveryResult> SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        logger.LogInformation(
            "📧 Email to {Email}: {Subject}\n{Body}",
            message.ToEmail, message.Subject, message.PlainTextBody ?? "(HTML)");

        return Task.FromResult(new DeliveryResult(true, $"log_{Guid.NewGuid():N}"));
    }
}
