namespace Rakr.Application.Common.Interfaces;

public interface IPaymentService
{
    // ── Customer Card Management ──

    /// <summary>Create a Stripe Customer object.</summary>
    Task<string> CreateStripeCustomerAsync(string email, string name, CancellationToken ct = default);

    /// <summary>Create a SetupIntent for saving a card (returns clientSecret).</summary>
    Task<string> CreateSetupIntentAsync(string stripeCustomerId, CancellationToken ct = default);

    /// <summary>Detach a payment method from a customer.</summary>
    Task DetachPaymentMethodAsync(string paymentMethodId, CancellationToken ct = default);

    // ── Platform Charges (customer card → platform balance) ──

    /// <summary>Charge a customer's saved card. Money goes to platform's Stripe balance.</summary>
    Task<ChargeResult> ChargeCustomerAsync(
        string stripeCustomerId, string paymentMethodId,
        int amountCents, string currency, string idempotencyKey,
        string? description = null, CancellationToken ct = default);

    // ── Vendor Payouts (platform balance → vendor bank via connected account) ──

    /// <summary>Transfer funds from platform balance to a vendor's connected account.</summary>
    Task<string> CreateTransferAsync(string vendorStripeAccountId, int amountCents, string currency, string idempotencyKey, CancellationToken ct = default);

    // ── Vendor Onboarding ──

    /// <summary>Create a Stripe Express connected account for vendor (bank + identity).</summary>
    Task<string> CreateConnectedAccountAsync(string email, string businessName, CancellationToken ct = default);

    /// <summary>Generate onboarding link for connected account.</summary>
    Task<string> CreateAccountLinkAsync(string accountId, string returnUrl, string refreshUrl, CancellationToken ct = default);

    /// <summary>Get Stripe Express dashboard link for vendor.</summary>
    Task<string> CreateDashboardLinkAsync(string accountId, CancellationToken ct = default);

    /// <summary>Check connected account status.</summary>
    Task<ConnectedAccountStatus> GetAccountStatusAsync(string accountId, CancellationToken ct = default);

    // ── Refunds ──

    /// <summary>Refund a payment (full or partial).</summary>
    Task<RefundResult> CreateRefundAsync(string paymentIntentId, int? amountCents, string reason, string idempotencyKey, CancellationToken ct = default);
}

public record ChargeResult(bool Succeeded, string? PaymentIntentId = null, string? ErrorMessage = null);
public record RefundResult(string RefundId, int AmountRefundedCents, string Status);
public record ConnectedAccountStatus(bool ChargesEnabled, bool PayoutsEnabled, bool DetailsSubmitted);
