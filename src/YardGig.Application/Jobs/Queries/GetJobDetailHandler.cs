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
        var j = await db.JobRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == request.JobId, cancellationToken);

        if (j is null)
            return Result<JobDetailDto>.Failure("Job not found.");

        var dto = new JobDetailDto(
            j.Id,
            j.Title,
            j.Description,
            j.Categories.ToArray(),
            j.Address,
            j.Location?.Y ?? 0,
            j.Location?.X ?? 0,
            j.Status.ToString(),
            j.BudgetCents,
            j.ScheduleStart,
            j.ScheduleEnd,
            j.Photos?.ToArray(),
            j.CreatedAt,
            j.CustomerProfileId
        );

        return Result<JobDetailDto>.Success(dto);
    }
}
