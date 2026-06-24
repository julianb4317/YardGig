namespace YardGig.Application.Notifications.Interfaces;

/// <summary>
/// Push notification provider abstraction (FCM, APNs).
/// </summary>
public interface IPushProvider
{
    Task<DeliveryResult> SendAsync(PushMessage message, CancellationToken ct = default);
}

public record PushMessage(
    string[] DeviceTokens,
    string Title,
    string Body,
    Dictionary<string, string>? Data = null,
    string? ImageUrl = null
);
