using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Jobs.Commands;

public record EditJobCommand(
    Guid JobId,
    string? Title,
    string? Description,
    string[]? Categories,
    int? BudgetCents,
    string[]? Photos
) : IRequest<Result>;
