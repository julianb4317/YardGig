using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Jobs.Commands;

public record AssignVendorCommand(Guid JobRequestId, Guid VendorRequestId) : IRequest<Result>;
