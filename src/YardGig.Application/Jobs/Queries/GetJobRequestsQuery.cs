using MediatR;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Jobs.Queries;

public record GetJobRequestsQuery(Guid JobRequestId) : IRequest<Result<List<VendorRequestDto>>>;

public record VendorRequestDto(
    Guid VendorRequestId,
    Guid VendorProfileId,
    string VendorName,
    string? BusinessName,
    decimal AverageRating,
    int TotalJobsCompleted,
    int? ProposedPriceCents,
    string? Note,
    double? DistanceMeters,
    string Status,
    DateTime CreatedAt
);
