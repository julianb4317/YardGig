using Rakr.Domain.Common;

namespace Rakr.Domain.Events;

public sealed class PaymentCapturedEvent(Guid paymentTransactionId, Guid jobRequestId) : DomainEvent
{
    public Guid PaymentTransactionId { get; } = paymentTransactionId;
    public Guid JobRequestId { get; } = jobRequestId;
}
