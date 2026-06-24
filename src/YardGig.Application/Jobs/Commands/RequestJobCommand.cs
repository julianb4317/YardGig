using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Jobs.Commands;

public record RequestJobCommand(
    Guid JobRequestId,
    int? ProposedPriceCents = null,
    string? Note = null
) : IRequest<Result<Guid>>;
