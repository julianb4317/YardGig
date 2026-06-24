using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Jobs.Commands;

public record CreateJobCommand(
    string Title,
    string Description,
    string[] Categories,
    string Address,
    int BudgetCents,
    DateTime? ScheduleStart,
    DateTime? ScheduleEnd,
    string[]? Photos
) : IRequest<Result<Guid>>;
