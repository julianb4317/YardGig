namespace YardGig.Application.Common.Interfaces;

public interface IPaymentService
{
    /// <summary>
    /// Creates a PaymentIntent with manual capture and destination charge to vendor.
    /// </summary>
    Task<PaymentIntentResult> CreatePaymentIntentAsync(
        int amountCents, string currency, string vendorStripeAccountId,
        int platformFeeCents, string idempotencyKey, string? statementDescriptor = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Captures an authorized PaymentIntent.
    /// </summary>
    Task<bool> CapturePaymentAsync(string paymentIntentId, string idempotencyKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a transfer to a vendor's connected account.
    /// </summary>
    Task<string> CreateTransferAsync(string vendorStripeAccountId, int amountCents, string currency, string idempotencyKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Issues a full or partial refund.
    /// </summary>
    Task<RefundResult> CreateRefundAsync(string paymentIntentId, int? amountCents, string reason, string idempotencyKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a Stripe Express connected account for vendor onboarding.
    /// </summary>
    Task<string> CreateConnectedAccountAsync(string email, string businessName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates an onboarding link for a connected account.
    /// </summary>
    Task<string> CreateAccountLinkAsync(string accountId, string returnUrl, string refreshUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the Express dashboard login link for a vendor.
    /// </summary>
    Task<string> CreateDashboardLinkAsync(string accountId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves account status (charges_enabled, payouts_enabled).
    /// </summary>
    Task<ConnectedAccountStatus> GetAccountStatusAsync(string accountId, CancellationToken cancellationToken = default);
}

public record PaymentIntentResult(string PaymentIntentId, string ClientSecret, string Status);
public record RefundResult(string RefundId, int AmountRefundedCents, string Status);
public record ConnectedAccountStatus(bool ChargesEnabled, bool PayoutsEnabled, bool DetailsSubmitted);
