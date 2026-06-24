namespace YardGig.Application.Notifications.Interfaces;

/// <summary>
/// Email delivery provider abstraction (SendGrid, SES, SMTP).
/// </summary>
public interface IEmailProvider
{
    Task<DeliveryResult> SendAsync(EmailMessage message, CancellationToken ct = default);
}

public record EmailMessage(
    string ToEmail,
    string ToName,
    string Subject,
    string HtmlBody,
    string? PlainTextBody = null,
    string? ReplyTo = null
);
