using Microsoft.Extensions.Logging;
using Rakr.Application.Notifications.Interfaces;

namespace Rakr.Infrastructure.Notifications;

/// <summary>
/// Development push provider that logs messages.
/// Replace with FcmPushProvider in production.
/// </summary>
public class LogPushProvider(ILogger<LogPushProvider> logger) : IPushProvider
{
    public Task<DeliveryResult> SendAsync(PushMessage message, CancellationToken ct = default)
    {
        logger.LogInformation(
            "🔔 Push to {DeviceCount} devices: {Title} - {Body}",
            message.DeviceTokens.Length, message.Title, message.Body);

        return Task.FromResult(new DeliveryResult(true, $"push_{Guid.NewGuid():N}"));
    }
}
