using MediatR;
using Rakr.Application.Common.Models;
using Rakr.Domain.Enums;

namespace Rakr.Application.Jobs.Commands;

public record UpdateJobStatusCommand(Guid JobRequestId, JobStatus NewStatus) : IRequest<Result>;
