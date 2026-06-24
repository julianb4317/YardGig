using MediatR;
using YardGig.Application.Common.Models;
using YardGig.Application.Jobs.Dtos;

namespace YardGig.Application.Jobs.Queries;

public record GetJobDetailQuery(Guid JobId) : IRequest<Result<JobDetailDto>>;
