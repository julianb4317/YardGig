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
    ICurrentUserService currentUser
) : IRequestHandler<CreateJobCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateJobCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<Guid>.Failure("Unauthorized.");

        // Ensure domain User exists (bridges Identity user to domain model)
        var domainUser = await db.Users.FindAsync([currentUser.UserId.Value], cancellationToken);
        if (domainUser is null)
        {
            domainUser = new ApplicationUser
            {
                Id = currentUser.UserId.Value,
                Email = currentUser.Email ?? "",
                DisplayName = currentUser.Email ?? "User",
                EmailVerified = true,
                AuthProvider = "local",
                IsActive = true
            };
            db.Users.Add(domainUser);
            await db.SaveChangesAsync(cancellationToken);
        }

        // Ensure CustomerProfile exists
        var customerProfile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value, cancellationToken);

        if (customerProfile is null)
        {
            customerProfile = new CustomerProfile
            {
                UserId = currentUser.UserId.Value
            };
            db.CustomerProfiles.Add(customerProfile);
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

        return Result<Guid>.Success(job.Id);
    }
}
