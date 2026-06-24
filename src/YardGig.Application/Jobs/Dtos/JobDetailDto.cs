namespace YardGig.Application.Jobs.Dtos;

public record JobDetailDto(
    Guid Id,
    string Title,
    string Description,
    string[] Categories,
    string Address,
    double Latitude,
    double Longitude,
    string Status,
    int BudgetCents,
    DateTime? ScheduleStart,
    DateTime? ScheduleEnd,
    string[]? Photos,
    DateTime CreatedAt,
    Guid CustomerProfileId
);
