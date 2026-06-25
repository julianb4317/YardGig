using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Payments.Commands;

/// <summary>
/// Deprecated handler — payment logic moved to PaymentsController.ChargeForJob().
/// Kept as a no-op so existing references compile.
/// </summary>
public class CapturePaymentHandler : IRequestHandler<CapturePaymentCommand, Result<Guid>>
{
    public Task<Result<Guid>> Handle(CapturePaymentCommand request, CancellationToken cancellationToken)
    {
        return Task.FromResult(Result<Guid>.Failure("Use POST /api/payments/charge instead."));
    }
}
