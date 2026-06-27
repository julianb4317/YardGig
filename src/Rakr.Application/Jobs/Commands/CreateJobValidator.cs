using FluentValidation;

namespace Rakr.Application.Jobs.Commands;

public class CreateJobValidator : AbstractValidator<CreateJobCommand>
{
    public CreateJobValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().MaximumLength(200);

        RuleFor(x => x.Description)
            .NotEmpty().MaximumLength(5000);

        RuleFor(x => x.Categories)
            .NotEmpty().WithMessage("At least one category is required.");

        RuleFor(x => x.Address)
            .NotEmpty().MaximumLength(500);

        RuleFor(x => x.BudgetCents)
            .GreaterThan(0).WithMessage("Budget must be positive.");

        RuleFor(x => x.ScheduleEnd)
            .GreaterThan(x => x.ScheduleStart)
            .When(x => x.ScheduleStart.HasValue && x.ScheduleEnd.HasValue)
            .WithMessage("Schedule end must be after start.");
    }
}
