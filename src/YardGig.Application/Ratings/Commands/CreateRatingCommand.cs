using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Ratings.Commands;

public record CreateRatingCommand(
    Guid JobRequestId,
    Guid RevieweeId,
    int Score,
    string? Comment
) : IRequest<Result<Guid>>;
