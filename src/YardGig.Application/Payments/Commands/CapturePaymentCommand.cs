using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Payments.Commands;

public record CapturePaymentCommand(Guid JobRequestId) : IRequest<Result<Guid>>;
