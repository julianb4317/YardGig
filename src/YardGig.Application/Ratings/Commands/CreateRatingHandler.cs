using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Entities;
using YardGig.Domain.Enums;

namespace YardGig.Application.Ratings.Commands;

public class CreateRatingHandler(
    IAppDbContext db,
    ICurrentUserService currentUser
) : IRequestHandler<CreateRatingCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateRatingCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result<Guid>.Failure("Unauthorized.");

        if (request.Score < 1 || request.Score > 5)
            return Result<Guid>.Failure("Score must be between 1 and 5.");

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .Include(j => j.Assignment)
            .FirstOrDefaultAsync(j => j.Id == request.JobRequestId, cancellationToken);

        if (job is null)
            return Result<Guid>.Failure("Job not found.");

        if (job.Status != JobStatus.Paid && job.Status != JobStatus.Closed)
            return Result<Guid>.Failure("Job must be paid before rating.");

        // Check if already rated
        var alreadyRated = await db.Ratings
            .AnyAsync(r => r.JobRequestId == request.JobRequestId && r.ReviewerId == currentUser.UserId.Value, cancellationToken);

        if (alreadyRated)
            return Result<Guid>.Failure("You have already rated this job.");

        var rating = new Rating
        {
            JobRequestId = request.JobRequestId,
            ReviewerId = currentUser.UserId.Value,
            RevieweeId = request.RevieweeId,
            Score = request.Score,
            Comment = request.Comment
        };

        db.Ratings.Add(rating);
        await db.SaveChangesAsync(cancellationToken);

        // Recalculate average for reviewee if they have a vendor profile
        var vendorProfile = await db.VendorProfiles
            .FirstOrDefaultAsync(vp => vp.UserId == request.RevieweeId, cancellationToken);

        if (vendorProfile is not null)
        {
            var avg = await db.Ratings
                .Where(r => r.RevieweeId == request.RevieweeId)
                .AverageAsync(r => (decimal)r.Score, cancellationToken);

            vendorProfile.AverageRating = avg;
            vendorProfile.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result<Guid>.Success(rating.Id);
    }
}
