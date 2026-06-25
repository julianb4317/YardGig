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

    // ─── Customer Card Management ───

    public async Task<string> CreateStripeCustomerAsync(string email, string name, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        var service = new CustomerService();
        var customer = await service.CreateAsync(new CustomerCreateOptions { Email = email, Name = name }, cancellationToken: ct);
        logger.LogInformation("Created Stripe Customer {Id} for {Email}", customer.Id, email);
        return customer.Id;
    }

    public async Task<string> CreateSetupIntentAsync(string stripeCustomerId, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        var service = new SetupIntentService();
        var intent = await service.CreateAsync(new SetupIntentCreateOptions
        {
            Customer = stripeCustomerId,
            PaymentMethodTypes = ["card"],
        }, cancellationToken: ct);
        return intent.ClientSecret;
    }

    public async Task DetachPaymentMethodAsync(string paymentMethodId, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        var service = new PaymentMethodService();
        await service.DetachAsync(paymentMethodId, cancellationToken: ct);
    }

    // ─── Platform Charges ───

    public async Task<ChargeResult> ChargeCustomerAsync(
        string stripeCustomerId, string paymentMethodId,
        int amountCents, string currency, string idempotencyKey,
        string? description = null, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var options = new PaymentIntentCreateOptions
        {
            Amount = amountCents,
            Currency = currency,
            Customer = stripeCustomerId,
            PaymentMethod = paymentMethodId,
            Confirm = true,             // Charge immediately
            OffSession = true,          // No customer present (saved card)
            Description = description,
            StatementDescriptor = "YARDGIG",
        };

        try
        {
            var service = new PaymentIntentService();
            var intent = await service.CreateAsync(options,
                new RequestOptions { IdempotencyKey = idempotencyKey }, ct);

            if (intent.Status == "succeeded")
            {
                logger.LogInformation("Charged {Amount}¢ from customer {CustomerId} (PI: {Id})",
                    amountCents, stripeCustomerId, intent.Id);
                return new ChargeResult(true, intent.Id);
            }

            logger.LogWarning("Charge not immediately succeeded. Status: {Status}", intent.Status);
            return new ChargeResult(false, intent.Id, $"Payment status: {intent.Status}");
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe charge failed for customer {CustomerId}", stripeCustomerId);
            return new ChargeResult(false, ErrorMessage: ex.Message);
        }
    }

    // ─── Vendor Payouts ───

    public async Task<string> CreateTransferAsync(
        string vendorStripeAccountId, int amountCents, string currency, string idempotencyKey,
        CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;

        var service = new TransferService();
        var transfer = await service.CreateAsync(new TransferCreateOptions
        {
            Amount = amountCents,
            Currency = currency,
            Destination = vendorStripeAccountId,
            Description = "Weekly payout from YardGig",
        }, new RequestOptions { IdempotencyKey = idempotencyKey }, ct);

        logger.LogInformation("Created Transfer {Id} ({Amount}¢) to {Account}",
            transfer.Id, amountCents, vendorStripeAccountId);
        return transfer.Id;
    }

    // ─── Vendor Onboarding ───

    public async Task<string> CreateConnectedAccountAsync(string email, string businessName, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        var service = new AccountService();
        var account = await service.CreateAsync(new AccountCreateOptions
        {
            Type = "express",
            Email = email,
            BusinessProfile = new AccountBusinessProfileOptions { Name = businessName },
            Capabilities = new AccountCapabilitiesOptions
            {
                Transfers = new AccountCapabilitiesTransfersOptions { Requested = true }
            }
        }, cancellationToken: ct);

        logger.LogInformation("Created Stripe Express account {Id} for {Email}", account.Id, email);
        return account.Id;
    }

    public async Task<string> CreateAccountLinkAsync(string accountId, string returnUrl, string refreshUrl, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        var service = new AccountLinkService();
        var link = await service.CreateAsync(new AccountLinkCreateOptions
        {
            Account = accountId,
            ReturnUrl = returnUrl,
            RefreshUrl = refreshUrl,
            Type = "account_onboarding"
        }, cancellationToken: ct);
        return link.Url;
    }

    public async Task<string> CreateDashboardLinkAsync(string accountId, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        // For Express accounts, return the connect dashboard URL
        return await Task.FromResult($"https://connect.stripe.com/express/{accountId}");
    }

    public async Task<ConnectedAccountStatus> GetAccountStatusAsync(string accountId, CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        var service = new AccountService();
        var account = await service.GetAsync(accountId, cancellationToken: ct);
        return new ConnectedAccountStatus(account.ChargesEnabled, account.PayoutsEnabled, account.DetailsSubmitted);
    }

    // ─── Refunds ───

    public async Task<RefundResult> CreateRefundAsync(
        string paymentIntentId, int? amountCents, string reason, string idempotencyKey,
        CancellationToken ct = default)
    {
        StripeConfiguration.ApiKey = ApiKey;
        var service = new RefundService();
        var refund = await service.CreateAsync(new RefundCreateOptions
        {
            PaymentIntent = paymentIntentId,
            Amount = amountCents,
            Reason = reason switch
            {
                "duplicate" => "duplicate",
                "fraudulent" => "fraudulent",
                _ => "requested_by_customer"
            }
        }, new RequestOptions { IdempotencyKey = idempotencyKey }, ct);

        return new RefundResult(refund.Id, (int)refund.Amount, refund.Status);
    }
}
