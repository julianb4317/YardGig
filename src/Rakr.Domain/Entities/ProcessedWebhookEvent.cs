namespace Rakr.Domain.Entities;

/// <summary>
/// Tracks Stripe webhook events to ensure idempotent processing.
/// </summary>
public class ProcessedWebhookEvent
{
    public string StripeEventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
