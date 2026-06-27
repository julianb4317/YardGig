using MediatR;
using Rakr.Application.Jobs.Dtos;

namespace Rakr.Application.Jobs.Queries;

/// <summary>
/// Returns jobs within a map viewport bounding box.
/// Primary query for the vendor Map Discovery view.
/// </summary>
public record GetJobsByBoundsQuery(
    double MinLat,
    double MaxLat,
    double MinLng,
    double MaxLng,
    double? VendorLat = null,
    double? VendorLng = null,
    Guid? VendorProfileId = null,
    string[]? Categories = null,
    int? MinBudgetCents = null,
    int? MaxBudgetCents = null,
    DateTime? DateFrom = null,
    DateTime? DateTo = null,
    int Limit = 200
) : IRequest<MapQueryResponse>;
