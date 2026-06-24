using System.Text.RegularExpressions;
using YardGig.Application.Notifications.Interfaces;

namespace YardGig.Infrastructure.Notifications;

/// <summary>
/// Simple template renderer using Mustache-style {{variable}} replacement.
/// In production, replace with Scriban or Razor engine.
/// </summary>
public partial class SimpleTemplateRenderer : ITemplateRenderer
{
    private static readonly Dictionary<string, NotificationTemplate> Templates = new()
    {
        ["vendor.requested"] = new(
            "A vendor wants your job: {{jobTitle}}",
            "<p>Hi {{customerName}},</p><p><strong>{{vendorName}}</strong> wants to work on your job <strong>\"{{jobTitle}}\"</strong>.</p><p>⭐ Rating: {{vendorRating}}/5</p><p><a href=\"{{appUrl}}/jobs/{{jobId}}/requests\">Review Request</a></p>"),

        ["job.assigned"] = new(
            "You got the job! 🎉 {{jobTitle}}",
            "<p>Hi {{vendorName}},</p><p>You've been assigned to <strong>\"{{jobTitle}}\"</strong>.</p><p>📍 Address will be revealed on start.</p><p>📅 Schedule: {{scheduleWindow}}</p><p><a href=\"{{appUrl}}/vendor/jobs/{{jobId}}\">View Job Details</a></p>"),

        ["job.completed"] = new(
            "Your job is done! Confirm & Pay",
            "<p>Hi {{customerName}},</p><p>{{vendorName}} has marked <strong>\"{{jobTitle}}\"</strong> as completed.</p><p>Please review the work and confirm to release payment.</p><p><a href=\"{{appUrl}}/jobs/{{jobId}}\">Confirm & Pay</a></p>"),

        ["job.confirmed_paid"] = new(
            "Payment received: {{payoutAmount}}",
            "<p>Hi {{vendorName}},</p><p>Payment for <strong>\"{{jobTitle}}\"</strong> has been processed.</p><p>💰 Amount: {{payoutAmount}}</p><p>Funds will arrive in your bank account within 2 business days.</p>"),

        ["job.cancelled"] = new(
            "Job cancelled: {{jobTitle}}",
            "<p>The job <strong>\"{{jobTitle}}\"</strong> has been cancelled by the customer.</p><p>{{cancellationReason}}</p>"),

        ["job.rescheduled"] = new(
            "Schedule changed: {{jobTitle}}",
            "<p>Hi {{vendorName}},</p><p>The schedule for <strong>\"{{jobTitle}}\"</strong> has been updated.</p><p>📅 New window: {{scheduleWindow}}</p><p>If this doesn't work, you can withdraw your request.</p>"),

        ["payment.failed"] = new(
            "Payment failed for {{jobTitle}}",
            "<p>Hi {{customerName}},</p><p>We couldn't process your payment for <strong>\"{{jobTitle}}\"</strong>.</p><p>Please update your payment method and try again.</p><p><a href=\"{{appUrl}}/jobs/{{jobId}}\">Retry Payment</a></p>"),

        ["account.welcome"] = new(
            "Welcome to YardGig! 🌿",
            "<p>Hi {{userName}},</p><p>Welcome to YardGig! Your account has been created.</p><p>Please verify your email to get started.</p><p><a href=\"{{appUrl}}/verify?token={{confirmToken}}\">Verify Email</a></p>"),

        ["account.vendor_approved"] = new(
            "Your vendor account is approved! ✅",
            "<p>Hi {{vendorName}},</p><p>Congratulations! Your vendor profile has been approved.</p><p>You can now browse and request jobs on the map.</p><p><a href=\"{{appUrl}}/vendor/map\">Start Finding Jobs</a></p>"),

        ["nudge.unresponsive"] = new(
            "You have pending vendor requests",
            "<p>Hi {{customerName}},</p><p>You have {{pendingCount}} vendors waiting to hear from you on <strong>\"{{jobTitle}}\"</strong>.</p><p><a href=\"{{appUrl}}/jobs/{{jobId}}/requests\">Review Requests</a></p>"),
    };

    public Task<RenderedTemplate> RenderAsync(string eventType, string channel, Dictionary<string, object> variables, CancellationToken ct = default)
    {
        if (!Templates.TryGetValue(eventType, out var template))
        {
            // Fallback generic template
            var title = eventType.Replace(".", " ").Replace("_", " ");
            return Task.FromResult(new RenderedTemplate(
                title,
                $"<p>Notification: {title}</p>",
                title));
        }

        var subject = ReplaceVariables(template.Subject, variables);
        var html = ReplaceVariables(template.HtmlBody, variables);
        var plainText = StripHtml(html);

        return Task.FromResult(new RenderedTemplate(subject, html, plainText));
    }

    private static string ReplaceVariables(string template, Dictionary<string, object> variables)
    {
        return VariablePattern().Replace(template, match =>
        {
            var key = match.Groups[1].Value;
            return variables.TryGetValue(key, out var value) ? value?.ToString() ?? "" : match.Value;
        });
    }

    private static string StripHtml(string html) =>
        HtmlTagPattern().Replace(html, "").Replace("&amp;", "&").Replace("&lt;", "<").Replace("&gt;", ">");

    [GeneratedRegex(@"\{\{(\w+)\}\}")]
    private static partial Regex VariablePattern();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex HtmlTagPattern();

    private record NotificationTemplate(string Subject, string HtmlBody);
}
