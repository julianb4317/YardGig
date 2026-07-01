using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;
using Rakr.Domain.Enums;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/webhooks")]
public class WebhooksController(
    IAppDbContext db,
    IConfiguration configuration,
    ILogger<WebhooksController> logger
) : ControllerBase
{
    /// <summary>
    /// Stripe webhook endpoint. Receives and processes payment events.
    /// </summary>
    [HttpPost("stripe")]
    public async Task<IActionResult> StripeWebhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var webhookSecret = configuration["Stripe:WebhookSecret"];

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                webhookSecret);
        }
        catch (StripeException ex)
        {
            logger.LogWarning("Stripe webhook signature verification failed: {Message}", ex.Message);
            return BadRequest(new { errors = new[] { "Invalid signature." } });
        }

        // Idempotency check
        var alreadyProcessed = await db.ProcessedWebhookEvents
            .AnyAsync(e => e.StripeEventId == stripeEvent.Id);

        if (alreadyProcessed)
        {
            logger.LogInformation("Webhook {EventId} already processed, skipping.", stripeEvent.Id);
            return Ok();
        }

        // Process event
        try
        {
            switch (stripeEvent.Type)
            {
                case "payment_intent.succeeded":
                    await HandlePaymentIntentSucceeded(stripeEvent);
                    break;

                case "payment_intent.payment_failed":
                    await HandlePaymentIntentFailed(stripeEvent);
                    break;

                case "charge.refunded":
                    await HandleChargeRefunded(stripeEvent);
                    break;

                case "charge.dispute.created":
                    await HandleDisputeCreated(stripeEvent);
                    break;

                case "transfer.failed":
                    await HandleTransferFailed(stripeEvent);
                    break;

                case "account.updated":
                    await HandleAccountUpdated(stripeEvent);
                    break;

                default:
                    logger.LogInformation("Unhandled webhook event type: {Type}", stripeEvent.Type);
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error processing webhook {EventId} ({Type})", stripeEvent.Id, stripeEvent.Type);
            // Return 200 to prevent Stripe retries for processing errors
            // The reconciliation job will catch any missed updates
        }

        // Mark as processed
        db.ProcessedWebhookEvents.Add(new ProcessedWebhookEvent
        {
            StripeEventId = stripeEvent.Id,
            EventType = stripeEvent.Type
        });
        await db.SaveChangesAsync();

        return Ok();
    }

    private async Task HandlePaymentIntentSucceeded(Event stripeEvent)
    {
        var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
        if (paymentIntent is null) return;

        var transaction = await db.PaymentTransactions
            .FirstOrDefaultAsync(pt => pt.StripePaymentIntentId == paymentIntent.Id);

        if (transaction is not null && transaction.Status != PaymentStatus.Captured)
        {
            transaction.Status = PaymentStatus.Captured;
            transaction.CapturedAt = DateTime.UtcNow;
            logger.LogInformation("Confirmed payment {Id} via webhook", transaction.Id);
        }
    }

    private async Task HandlePaymentIntentFailed(Event stripeEvent)
    {
        var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
        if (paymentIntent is null) return;

        var transaction = await db.PaymentTransactions
            .FirstOrDefaultAsync(pt => pt.StripePaymentIntentId == paymentIntent.Id);

        if (transaction is not null)
        {
            transaction.Status = PaymentStatus.Failed;
            logger.LogWarning("Payment {Id} failed via webhook", transaction.Id);
        }
    }

    private async Task HandleChargeRefunded(Event stripeEvent)
    {
        var charge = stripeEvent.Data.Object as Charge;
        if (charge is null) return;

        var transaction = await db.PaymentTransactions
            .FirstOrDefaultAsync(pt => pt.StripePaymentIntentId == charge.PaymentIntentId);

        if (transaction is not null)
        {
            transaction.Status = PaymentStatus.Refunded;
            logger.LogInformation("Payment {Id} refunded via webhook", transaction.Id);
        }
    }

    private async Task HandleDisputeCreated(Event stripeEvent)
    {
        // Stripe dispute → create internal dispute record
        logger.LogWarning("Stripe dispute created for event {Id}. Manual review required.", stripeEvent.Id);
        await Task.CompletedTask;
    }

    private async Task HandleTransferFailed(Event stripeEvent)
    {
        var transfer = stripeEvent.Data.Object as Transfer;
        if (transfer is null) return;

        var payout = await db.Payouts
            .FirstOrDefaultAsync(p => p.StripeTransferId == transfer.Id);

        if (payout is not null)
        {
            payout.Status = PayoutStatus.Failed;
            logger.LogWarning("Payout {Id} (Transfer {TransferId}) failed", payout.Id, transfer.Id);
        }
    }

    private async Task HandleAccountUpdated(Event stripeEvent)
    {
        var account = stripeEvent.Data.Object as Account;
        if (account is null) return;

        var vendor = await db.VendorProfiles
            .FirstOrDefaultAsync(v => v.StripeAccountId == account.Id);

        if (vendor is not null && account.ChargesEnabled)
        {
            logger.LogInformation("Vendor {Id} Stripe account now charges-enabled", vendor.Id);
        }

        await Task.CompletedTask;
    }
}
