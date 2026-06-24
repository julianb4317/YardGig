using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;
using YardGig.Application.Common.Interfaces;

namespace YardGig.Infrastructure.Services;

public class StripePaymentService(
    IConfiguration configuration,
    ILogger<StripePaymentService> logger
) : IPaymentService
{
    private string ApiKey => configuration["Stripe:SecretKey"]
        ?? throw new InvalidOperationException("Stripe:SecretKey not configured");

    public async Task<PaymentIntentResult> CreatePaymentIntentAsync(
        int amountCents, string currency, string vendorStripeAccountId,
        int platformFeeCents, string idempotencyKey, string? statementDescriptor = null,
        CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var options = new PaymentIntentCreateOptions
        {
            Amount = amountCents,
            Currency = currency,
            CaptureMethod = "manual", // Authorize first, capture later
            ApplicationFeeAmount = platformFeeCents,
            TransferData = new PaymentIntentTransferDataOptions
            {
                Destination = vendorStripeAccountId
            },
            StatementDescriptor = statementDescriptor?[..Math.Min(statementDescriptor.Length, 22)],
            Metadata = new Dictionary<string, string>
            {
                ["idempotency_key"] = idempotencyKey
            }
        };

        var service = new PaymentIntentService();
        var intent = await service.CreateAsync(options,
            new RequestOptions { IdempotencyKey = idempotencyKey },
            cancellationToken);

        logger.LogInformation("Created PaymentIntent {Id} for {Amount} {Currency} (key: {Key})",
            intent.Id, amountCents, currency, idempotencyKey);

        return new PaymentIntentResult(intent.Id, intent.ClientSecret, intent.Status);
    }

    public async Task<bool> CapturePaymentAsync(string paymentIntentId, string idempotencyKey, CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var service = new PaymentIntentService();
        var intent = await service.CaptureAsync(paymentIntentId, null,
            new RequestOptions { IdempotencyKey = idempotencyKey },
            cancellationToken);

        logger.LogInformation("Captured PaymentIntent {Id}, status: {Status}", intent.Id, intent.Status);
        return intent.Status == "succeeded";
    }

    public async Task<string> CreateTransferAsync(
        string vendorStripeAccountId, int amountCents, string currency, string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var options = new TransferCreateOptions
        {
            Amount = amountCents,
            Currency = currency,
            Destination = vendorStripeAccountId
        };

        var service = new TransferService();
        var transfer = await service.CreateAsync(options,
            new RequestOptions { IdempotencyKey = idempotencyKey },
            cancellationToken);

        logger.LogInformation("Created Transfer {Id} to {Account} (key: {Key})",
            transfer.Id, vendorStripeAccountId, idempotencyKey);
        return transfer.Id;
    }

    public async Task<RefundResult> CreateRefundAsync(
        string paymentIntentId, int? amountCents, string reason, string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var options = new RefundCreateOptions
        {
            PaymentIntent = paymentIntentId,
            Amount = amountCents, // null = full refund
            Reason = reason switch
            {
                "duplicate" => "duplicate",
                "fraudulent" => "fraudulent",
                _ => "requested_by_customer"
            }
        };

        var service = new RefundService();
        var refund = await service.CreateAsync(options,
            new RequestOptions { IdempotencyKey = idempotencyKey },
            cancellationToken);

        logger.LogInformation("Created Refund {Id} for PaymentIntent {PiId}, amount: {Amount}",
            refund.Id, paymentIntentId, amountCents ?? refund.Amount);

        return new RefundResult(refund.Id, (int)refund.Amount, refund.Status);
    }

    public async Task<string> CreateConnectedAccountAsync(string email, string businessName, CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var options = new AccountCreateOptions
        {
            Type = "express",
            Email = email,
            BusinessProfile = new AccountBusinessProfileOptions
            {
                Name = businessName
            },
            Capabilities = new AccountCapabilitiesOptions
            {
                Transfers = new AccountCapabilitiesTransfersOptions { Requested = true }
            }
        };

        var service = new AccountService();
        var account = await service.CreateAsync(options, cancellationToken: cancellationToken);

        logger.LogInformation("Created Stripe Express account {Id} for {Email}", account.Id, email);
        return account.Id;
    }

    public async Task<string> CreateAccountLinkAsync(string accountId, string returnUrl, string refreshUrl, CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var options = new AccountLinkCreateOptions
        {
            Account = accountId,
            RefreshUrl = refreshUrl,
            ReturnUrl = returnUrl,
            Type = "account_onboarding"
        };

        var service = new AccountLinkService();
        var link = await service.CreateAsync(options, cancellationToken: cancellationToken);

        return link.Url;
    }

    public async Task<string> CreateDashboardLinkAsync(string accountId, CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        // Create a login link for the Express dashboard
        var options = new AccountSessionCreateOptions
        {
            Account = accountId,
            Components = new AccountSessionComponentsOptions
            {
                AccountOnboarding = new AccountSessionComponentsAccountOnboardingOptions
                {
                    Enabled = true
                }
            }
        };

        // For Express accounts, use the Account Login Link
        var requestOptions = new RequestOptions();
        var service = new Stripe.AccountService();
        var account = await service.GetAsync(accountId, cancellationToken: cancellationToken);

        // Return the Stripe Express dashboard URL
        return $"https://connect.stripe.com/express/{accountId}";
    }

    public async Task<ConnectedAccountStatus> GetAccountStatusAsync(string accountId, CancellationToken cancellationToken = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var service = new AccountService();
        var account = await service.GetAsync(accountId, cancellationToken: cancellationToken);

        return new ConnectedAccountStatus(
            account.ChargesEnabled,
            account.PayoutsEnabled,
            account.DetailsSubmitted
        );
    }
}
