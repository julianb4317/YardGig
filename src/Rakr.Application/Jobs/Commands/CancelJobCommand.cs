using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Jobs.Commands;

public record CancelJobCommand(Guid JobRequestId, string? Reason = null) : IRequest<Result<CancelJobResult>>;

public record CancelJobResult(bool PenaltyApplied, int PenaltyCents = 0);
