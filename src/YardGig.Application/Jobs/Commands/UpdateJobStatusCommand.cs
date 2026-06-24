using MediatR;
using YardGig.Application.Common.Models;
using YardGig.Domain.Enums;

namespace YardGig.Application.Jobs.Commands;

public record UpdateJobStatusCommand(Guid JobRequestId, JobStatus NewStatus) : IRequest<Result>;
