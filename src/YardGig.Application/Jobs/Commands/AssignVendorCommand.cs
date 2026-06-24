using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Jobs.Commands;

public record AssignVendorCommand(Guid JobRequestId, Guid VendorRequestId) : IRequest<Result>;
