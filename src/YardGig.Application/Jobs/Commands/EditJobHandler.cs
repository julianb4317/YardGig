using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Commands;

public class EditJobHandler(
    IAppDbContext db,
    ICurrentUserService currentUser
) : IRequestHandler<EditJobCommand, Result>
{
    private static readonly JobStatus[] EditableStatuses = [JobStatus.Open, JobStatus.Requested];

    public async Task<Result> Handle(EditJobCommand request, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
            return Result.Failure("Unauthorized.");

        var job = await db.JobRequests
            .Include(j => j.CustomerProfile)
            .FirstOrDefaultAsync(j => j.Id == request.JobId, cancellationToken);

        if (job is null)
            return Result.Failure("Job not found.");

        if (job.CustomerProfile.UserId != currentUser.UserId.Value)
            return Result.Failure("Only the job owner can edit.");

        if (!EditableStatuses.Contains(job.Status))
            return Result.Failure($"Cannot edit a job in {job.Status} status. Cancel and re-create instead.");

        if (request.Title is not null) job.Title = request.Title;
        if (request.Description is not null) job.Description = request.Description;
        if (request.Categories is not null) job.Categories = request.Categories.ToList();
        if (request.BudgetCents.HasValue) job.BudgetCents = request.BudgetCents.Value;
        if (request.Photos is not null) job.Photos = request.Photos.ToList();

        job.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
