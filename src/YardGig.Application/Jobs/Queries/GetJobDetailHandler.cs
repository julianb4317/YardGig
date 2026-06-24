using MediatR;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;
using YardGig.Application.Jobs.Dtos;

namespace YardGig.Application.Jobs.Queries;

public class GetJobDetailHandler(IAppDbContext db) : IRequestHandler<GetJobDetailQuery, Result<JobDetailDto>>
{
    public async Task<Result<JobDetailDto>> Handle(GetJobDetailQuery request, CancellationToken cancellationToken)
    {
        var job = await db.JobRequests
            .AsNoTracking()
            .Where(j => j.Id == request.JobId)
            .Select(j => new JobDetailDto(
                j.Id,
                j.Title,
                j.Description,
                j.Categories.ToArray(),
                j.Address,
                j.Location.Y,
                j.Location.X,
                j.Status.ToString(),
                j.BudgetCents,
                j.ScheduleStart,
                j.ScheduleEnd,
                j.Photos != null ? j.Photos.ToArray() : null,
                j.CreatedAt,
                j.CustomerProfileId
            ))
            .FirstOrDefaultAsync(cancellationToken);

        return job is null
            ? Result<JobDetailDto>.Failure("Job not found.")
            : Result<JobDetailDto>.Success(job);
    }
}
