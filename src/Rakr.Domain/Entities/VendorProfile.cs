using NetTopologySuite.Geometries;
using Rakr.Domain.Common;
using Rakr.Domain.Enums;

namespace Rakr.Domain.Entities;

public class VendorProfile : BaseEntity
{
    public Guid UserId { get; set; }
    public string? BusinessName { get; set; }
    public string? Bio { get; set; }
    public string? BusinessAddress { get; set; }
    public double? BusinessLatitude { get; set; }
    public double? BusinessLongitude { get; set; }
    public List<string> ServiceCategories { get; set; } = [];
    public int ServiceRadiusMiles { get; set; } = 15;
    public Point? HomeLocation { get; set; } // SRID 4326
    public string? InsuranceDocUrl { get; set; }

    // Insurance details
    public string? InsuranceCarrier { get; set; }
    public DateTime? InsuranceExpirationDate { get; set; }
    public string? InsuranceLiabilityType { get; set; } // "General Liability", "Commercial Auto", etc.
    public int? InsuranceLiabilityAmountCents { get; set; }
    public bool InsuranceVerified { get; set; } // Set true by admin after verification

    public VerificationStatus VerificationStatus { get; set; } = VerificationStatus.Pending;
    public string? StripeAccountId { get; set; }
    public bool StripeOnboarded { get; set; }
    public decimal AverageRating { get; set; }
    public int TotalJobsCompleted { get; set; }

    // Navigation
    public ApplicationUser User { get; set; } = null!;
    public ICollection<VendorRequest> VendorRequests { get; set; } = [];
    public ICollection<JobAssignment> Assignments { get; set; } = [];
}
