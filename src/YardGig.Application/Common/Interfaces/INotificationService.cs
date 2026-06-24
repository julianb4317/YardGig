namespace YardGig.Application.Common.Interfaces;

public interface INotificationService
{
    Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
    Task SendInAppNotificationAsync(Guid userId, string type, string title, string? body, object? metadata, CancellationToken cancellationToken = default);
}
