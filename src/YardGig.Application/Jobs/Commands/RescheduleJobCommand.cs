using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Jobs.Commands;

public record RescheduleJobCommand(
    Guid JobRequestId,
    DateTime ScheduleStart,
    DateTime ScheduleEnd
) : IRequest<Result>;
