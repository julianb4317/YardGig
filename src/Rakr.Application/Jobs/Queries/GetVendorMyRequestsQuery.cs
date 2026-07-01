using MediatR;

namespace Rakr.Application.Jobs.Queries;

public record GetVendorMyRequestsQuery(Guid UserId) : IRequest<List<VendorMyRequestDto>>;

public record VendorMyRequestDto(
    Guid VendorRequestId,
    Guid JobId,
    string JobTitle,
    int BudgetCents,
    string Status,         // VendorRequest status (Pending, Accepted, etc.)
    string JobStatus,      // Actual job status (Open, Assigned, InProgress, Completed, etc.)
    int? ProposedPriceCents,
    string PricingType,
    int? HourlyRateCents,
    decimal? EstimatedHours,
    decimal? MaxHours,
    DateTime CreatedAt
);
