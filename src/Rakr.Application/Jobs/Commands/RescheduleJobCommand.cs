using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Jobs.Commands;

public record RescheduleJobCommand(
    Guid JobRequestId,
    DateTime ScheduleStart,
    DateTime ScheduleEnd
) : IRequest<Result>;
