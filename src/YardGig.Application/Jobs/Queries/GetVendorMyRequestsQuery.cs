using MediatR;

namespace YardGig.Application.Jobs.Queries;

public record GetVendorMyRequestsQuery(Guid UserId) : IRequest<List<VendorMyRequestDto>>;

public record VendorMyRequestDto(
    Guid VendorRequestId,
    Guid JobId,
    string JobTitle,
    int BudgetCents,
    string Status,
    int? ProposedPriceCents,
    DateTime CreatedAt
);
