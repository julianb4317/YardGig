namespace YardGig.Application.Notifications.Interfaces;

/// <summary>
/// Template rendering engine for notification content.
/// </summary>
public interface ITemplateRenderer
{
    Task<RenderedTemplate> RenderAsync(string eventType, string channel, Dictionary<string, object> variables, CancellationToken ct = default);
}

public record RenderedTemplate(string Subject, string HtmlBody, string? PlainTextBody);

/// <summary>
/// Common delivery result for all providers.
/// </summary>
public record DeliveryResult(
    bool Succeeded,
    string? ProviderId = null,
    string? ErrorMessage = null
);
