using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Entities;
using YardGig.Domain.Enums;
using YardGig.Domain.Events;

namespace YardGig.Application.Jobs.Commands;

public class CreateJobHandler(
    IAppDbContext db,
    IGeocodingService geocoding,
    ICurrentUserService currentUser,
    IPaymentService paymentService,
    ICommissionService commissionService
) : IRequestHandler<CreateJobCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateJobCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<Guid>.Failure("Unauthorized.");

        // Ensure domain User and CustomerProfile exist
        var customerProfile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value, cancellationToken);

        if (customerProfile is null)
        {
            // Check if domain user exists
            var domainUser = await db.Users.FindAsync([currentUser.UserId.Value], cancellationToken);
            if (domainUser is null)
            {
                db.Users.Add(new ApplicationUser
                {
                    Id = currentUser.UserId.Value,
                    Email = currentUser.Email ?? "",
                    DisplayName = currentUser.Email ?? "User",
                    EmailVerified = true,
                    AuthProvider = "local",
                    IsActive = true
                });
            }

            customerProfile = new CustomerProfile { UserId = currentUser.UserId.Value };
            db.CustomerProfiles.Add(customerProfile);

            // Save user + profile first, before the job (FK dependency)
            await db.SaveChangesAsync(cancellationToken);
        }

        var location = await geocoding.GeocodeAddressAsync(request.Address, cancellationToken);
        if (location is null)
            return Result<Guid>.Failure("We couldn't locate this address. Please refine it.");

        var job = new JobRequest
        {
            CustomerProfileId = customerProfile.Id,
            Title = request.Title,
            Description = request.Description,
            Categories = request.Categories.ToList(),
            Address = request.Address,
            Location = location,
            Status = JobStatus.Open,
            BudgetCents = request.BudgetCents,
            ScheduleStart = request.ScheduleStart,
            ScheduleEnd = request.ScheduleEnd,
            Photos = request.Photos?.ToList(),
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        job.AddDomainEvent(new JobCreatedEvent(job.Id));

        db.JobRequests.Add(job);
        await db.SaveChangesAsync(cancellationToken);

        // ESCROW: Charge customer's card and hold funds
        var card = await db.CustomerPaymentMethods
            .FirstOrDefaultAsync(pm => pm.CustomerProfileId == customerProfile.Id && pm.IsDefault, cancellationToken);

        if (card is not null)
        {
            var fees = await commissionService.CalculateFeesAsync(
                request.BudgetCents, Guid.Empty, request.Categories, cancellationToken);

            var chargeResult = await paymentService.ChargeCustomerAsync(
                card.StripeCustomerId, card.StripePaymentMethodId,
                fees.GrossAmountCents, "usd", $"escrow_{job.Id}",
                $"YardGig escrow: {request.Title[..Math.Min(request.Title.Length, 30)]}", cancellationToken);

            if (chargeResult.Succeeded)
            {
                db.EscrowTransactions.Add(new EscrowTransaction
                {
                    JobRequestId = job.Id,
                    CustomerProfileId = customerProfile.Id,
                    StripePaymentIntentId = chargeResult.PaymentIntentId,
                    AmountCents = fees.GrossAmountCents,
                    PlatformFeeCents = fees.PlatformFeeCents,
                    VendorAmountCents = fees.VendorNetCents,
                    Status = EscrowStatus.Held
                });
                await db.SaveChangesAsync(cancellationToken);
            }
            // If charge fails, job is still created but without escrow (customer can add card later)
        }

        return Result<Guid>.Success(job.Id);
    }
}
