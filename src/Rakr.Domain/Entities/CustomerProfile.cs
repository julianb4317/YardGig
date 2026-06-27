using NetTopologySuite.Geometries;
using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

public class CustomerProfile : BaseEntity
{
    public Guid UserId { get; set; }
    public string? DefaultAddress { get; set; }
    public Point? DefaultLocation { get; set; } // SRID 4326
    public string? StripeCustomerId { get; set; }

    // Navigation
    public ApplicationUser User { get; set; } = null!;
    public ICollection<JobRequest> JobRequests { get; set; } = [];
}
