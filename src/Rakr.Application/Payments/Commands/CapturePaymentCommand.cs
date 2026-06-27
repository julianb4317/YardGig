using MediatR;
using Rakr.Application.Common.Models;

namespace Rakr.Application.Payments.Commands;

/// <summary>
/// Deprecated: Payment is now handled directly in the PaymentsController.
/// Kept for backward compatibility with any remaining references.
/// </summary>
public record CapturePaymentCommand(Guid JobRequestId) : IRequest<Result<Guid>>;
