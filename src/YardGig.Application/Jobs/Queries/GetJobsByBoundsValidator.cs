using FluentValidation;

namespace YardGig.Application.Jobs.Queries;

public class GetJobsByBoundsValidator : AbstractValidator<GetJobsByBoundsQuery>
{
    public GetJobsByBoundsValidator()
    {
        RuleFor(x => x.MinLat).InclusiveBetween(-90, 90);
        RuleFor(x => x.MaxLat).InclusiveBetween(-90, 90);
        RuleFor(x => x.MinLng).InclusiveBetween(-180, 180);
        RuleFor(x => x.MaxLng).InclusiveBetween(-180, 180);

        RuleFor(x => x.MaxLat)
            .GreaterThan(x => x.MinLat)
            .WithMessage("maxLat must be greater than minLat.");

        RuleFor(x => x.MaxLng)
            .GreaterThan(x => x.MinLng)
            .WithMessage("maxLng must be greater than minLng.");

        RuleFor(x => x.Limit)
            .InclusiveBetween(1, 500)
            .WithMessage("Limit must be between 1 and 500.");

        // Prevent fetching the entire planet
        RuleFor(x => x)
            .Must(x => (x.MaxLat - x.MinLat) < 5.0)
            .WithMessage("Viewport too large. Please zoom in.");
    }
}
