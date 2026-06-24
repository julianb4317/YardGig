using NetTopologySuite.Geometries;
using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

public class VendorProfile : BaseEntity
{
    public Guid UserId { get; set; }
    public string? BusinessName { get; set; }
    public string? Bio { get; set; }
    public List<string> ServiceCategories { get; set; } = [];
    public int ServiceRadiusMiles { get; set; } = 15;
    public Point? HomeLocation { get; set; } // SRID 4326
    public string? InsuranceDocUrl { get; set; }
    public VerificationStatus VerificationStatus { get; set; } = VerificationStatus.Pending;
    public string? StripeAccountId { get; set; }
    public decimal AverageRating { get; set; }
    public int TotalJobsCompleted { get; set; }

    // Navigation
    public ApplicationUser User { get; set; } = null!;
    public ICollection<VendorRequest> VendorRequests { get; set; } = [];
    public ICollection<JobAssignment> Assignments { get; set; } = [];
}
