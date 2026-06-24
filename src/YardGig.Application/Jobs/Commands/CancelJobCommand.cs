using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Jobs.Commands;

public record CancelJobCommand(Guid JobRequestId, string? Reason = null) : IRequest<Result<CancelJobResult>>;

public record CancelJobResult(bool PenaltyApplied, int PenaltyCents = 0);
