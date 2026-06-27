using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Jobs.Commands;

public record WithdrawRequestCommand(Guid JobRequestId) : IRequest<Result>;
