using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Ratings.Commands;

public record CreateRatingCommand(
    Guid JobRequestId,
    Guid RevieweeId,
    int Score,
    string? Comment
) : IRequest<Result<Guid>>;
