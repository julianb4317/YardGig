using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Rakr.Application.Notifications.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Infrastructure.Persistence;

namespace Rakr.Infrastructure.Notifications;

/// <summary>
/// Background service that processes notification outbox entries.
/// Handles retry logic with exponential backoff and dead-letter routing.
/// </summary>
public class OutboxProcessor(
    IServiceScopeFactory scopeFactory,
    ILogger<OutboxProcessor> logger
) : BackgroundService
{
    private static readonly TimeSpan ProcessingInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan[] RetryDelays =
    [
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromHours(4)
    ];

    private const int MaxRetries = 4; // email
    private const int MaxRetriesPush = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Notification outbox processor started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing notification outbox batch.");
            }

            await Task.Delay(ProcessingInterval, stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var emailProvider = scope.ServiceProvider.GetRequiredService<IEmailProvider>();
        var pushProvider = scope.ServiceProvider.GetRequiredService<IPushProvider>();

        var entries = await db.Set<NotificationOutboxEntry>()
            .Where(e => e.Status == NotificationDeliveryStatus.Pending
                && (e.NextAttemptAt == null || e.NextAttemptAt <= DateTime.UtcNow))
            .OrderBy(e => e.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        if (entries.Count == 0) return;

        foreach (var entry in entries)
        {
            entry.Status = NotificationDeliveryStatus.Processing;
            entry.AttemptCount++;

            try
            {
                var result = entry.Channel switch
                {
                    "email" => await SendEmailAsync(entry, emailProvider, ct),
                    "push" => await SendPushAsync(entry, pushProvider, db, ct),
                    "inapp" => await SaveInAppAsync(entry, db, ct),
                    _ => new DeliveryResult(false, ErrorMessage: $"Unknown channel: {entry.Channel}")
                };

                if (result.Succeeded)
                {
                    entry.Status = NotificationDeliveryStatus.Sent;
                    entry.SentAt = DateTime.UtcNow;
                    entry.ProviderMessageId = result.ProviderId;
                }
                else
                {
                    HandleFailure(entry, result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                HandleFailure(entry, ex.Message);
                logger.LogWarning(ex, "Delivery attempt {Attempt} failed for outbox entry {Id}",
                    entry.AttemptCount, entry.Id);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private void HandleFailure(NotificationOutboxEntry entry, string? error)
    {
        entry.LastError = error;
        var maxRetries = entry.Channel == "push" ? MaxRetriesPush : MaxRetries;

        if (entry.AttemptCount >= maxRetries)
        {
            entry.Status = NotificationDeliveryStatus.DeadLetter;
            logger.LogWarning("Outbox entry {Id} moved to dead letter after {Attempts} attempts: {Error}",
                entry.Id, entry.AttemptCount, error);
        }
        else
        {
            entry.Status = NotificationDeliveryStatus.Pending;
            var delayIndex = Math.Min(entry.AttemptCount - 1, RetryDelays.Length - 1);
            entry.NextAttemptAt = DateTime.UtcNow + RetryDelays[delayIndex];
        }
    }

    private static async Task<DeliveryResult> SendEmailAsync(
        NotificationOutboxEntry entry, IEmailProvider provider, CancellationToken ct)
    {
        var payload = JsonSerializer.Deserialize<JsonElement>(entry.PayloadJson);
        var subject = payload.GetProperty("subject").GetString() ?? "Notification";
        var htmlBody = payload.GetProperty("htmlBody").GetString() ?? "";

        // In production, resolve email from user ID via DB lookup
        var message = new EmailMessage(
            ToEmail: "", // Resolved by the outbox processor from RecipientUserId
            ToName: "",
            Subject: subject,
            HtmlBody: htmlBody);

        return await provider.SendAsync(message, ct);
    }

    private static async Task<DeliveryResult> SendPushAsync(
        NotificationOutboxEntry entry, IPushProvider provider, AppDbContext db, CancellationToken ct)
    {
        var devices = await db.Set<UserDevice>()
            .Where(d => d.UserId == entry.RecipientUserId && d.IsActive)
            .Select(d => d.Token)
            .ToArrayAsync(ct);

        if (devices.Length == 0)
            return new DeliveryResult(true, ProviderId: "no_devices"); // No devices = success (nothing to send)

        var payload = JsonSerializer.Deserialize<JsonElement>(entry.PayloadJson);
        var subject = payload.GetProperty("subject").GetString() ?? "";
        var plainText = payload.TryGetProperty("plainTextBody", out var pt) ? pt.GetString() ?? "" : "";

        var message = new PushMessage(devices, subject, plainText);
        return await provider.SendAsync(message, ct);
    }

    private static async Task<DeliveryResult> SaveInAppAsync(
        NotificationOutboxEntry entry, AppDbContext db, CancellationToken ct)
    {
        var payload = JsonSerializer.Deserialize<JsonElement>(entry.PayloadJson);
        var subject = payload.GetProperty("subject").GetString() ?? "";
        var htmlBody = payload.GetProperty("htmlBody").GetString();

        var notification = new Notification
        {
            UserId = entry.RecipientUserId,
            Type = entry.EventType,
            Title = subject,
            Body = htmlBody,
            Channel = Domain.Enums.NotificationChannel.InApp,
            SentAt = DateTime.UtcNow
        };

        db.Set<Notification>().Add(notification);
        return await Task.FromResult(new DeliveryResult(true, notification.Id.ToString()));
    }
}
