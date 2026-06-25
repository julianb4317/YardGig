using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Payments.Commands;

/// <summary>
/// Deprecated: Payment is now handled directly in the PaymentsController.
/// Kept for backward compatibility with any remaining references.
/// </summary>
public record CapturePaymentCommand(Guid JobRequestId) : IRequest<Result<Guid>>;
