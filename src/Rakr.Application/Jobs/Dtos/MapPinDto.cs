namespace Rakr.Application.Jobs.Dtos;

/// <summary>
/// Extended pin DTO for viewport-based map queries.
/// Includes vendor-specific state (whether already requested).
/// </summary>
public record MapPinDto(
    Guid Id,
    string Title,
    string[] Categories,
    int BudgetCents,
    double Latitude,
    double Longitude,
    DateTime? ScheduleStart,
    DateTime? ScheduleEnd,
    double DistanceMeters,
    bool VendorRequested,
    DateTime? ExpiresAt,
    string PricingType = "fixed",
    int? HourlyRateCents = null,
    decimal? EstimatedHours = null,
    decimal? MaxHours = null
);

public record MapQueryResponse(
    List<MapPinDto> Pins,
    int TotalInBounds,
    bool Truncated
);
