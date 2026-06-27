using MediatR;
using Rakr.Application.Common.Models;
using Rakr.Application.Jobs.Dtos;

namespace Rakr.Application.Jobs.Queries;

public record GetJobDetailQuery(Guid JobId) : IRequest<Result<JobDetailDto>>;
