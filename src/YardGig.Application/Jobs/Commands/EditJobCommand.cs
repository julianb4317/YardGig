using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Jobs.Commands;

public record EditJobCommand(
    Guid JobId,
    string? Title,
    string? Description,
    string[]? Categories,
    int? BudgetCents,
    string[]? Photos
) : IRequest<Result>;
