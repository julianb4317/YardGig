namespace Rakr.Application.Jobs.Dtos;

/// <summary>
/// Lightweight DTO for map pins — optimized for rendering many markers.
/// </summary>
public record JobPinDto(
    Guid Id,
    string Title,
    string[] Categories,
    int BudgetCents,
    double Latitude,
    double Longitude,
    DateTime? ScheduleStart,
    DateTime? ScheduleEnd,
    double DistanceMeters
);
