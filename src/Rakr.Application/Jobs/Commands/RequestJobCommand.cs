using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Jobs.Commands;

public record RequestJobCommand(
    Guid JobRequestId,
    int? ProposedPriceCents = null,
    string? Note = null
) : IRequest<Result<Guid>>;
