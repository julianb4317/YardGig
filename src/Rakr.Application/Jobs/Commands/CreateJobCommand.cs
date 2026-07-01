using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Jobs.Commands;

public record CreateJobCommand(
    string Title,
    string Description,
    string[] Categories,
    string Address,
    int BudgetCents,
    DateTime? ScheduleStart,
    DateTime? ScheduleEnd,
    string[]? Photos,
    bool IsRecurring = false,
    string? RecurringFrequency = null,
    string[]? RecurringDays = null,
    string? RecurringTime = null,
    string PricingType = "fixed",
    int? HourlyRateCents = null,
    decimal? EstimatedHours = null,
    decimal? MaxHours = null,
    string? JobDetailsJson = null
) : IRequest<Result<Guid>>;
