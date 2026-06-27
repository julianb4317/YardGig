using MediatR;
using Rakr.Application.Jobs.Dtos;

namespace Rakr.Application.Jobs.Queries;

/// <summary>
/// Returns job pins within a radius of the given coordinates.
/// Used by the vendor Map Discovery view.
/// </summary>
public record GetNearbyJobsQuery(
    double Latitude,
    double Longitude,
    double RadiusMeters,
    string[]? Categories = null,
    int? MinBudgetCents = null,
    int? MaxBudgetCents = null,
    int Limit = 200
) : IRequest<List<JobPinDto>>;
