using MediatR;
using YardGig.Application.Jobs.Dtos;

namespace YardGig.Application.Jobs.Queries;

public record GetMyJobsQuery(
    Guid UserId,
    string? Status = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<PaginatedResult<JobDetailDto>>;

public record PaginatedResult<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
