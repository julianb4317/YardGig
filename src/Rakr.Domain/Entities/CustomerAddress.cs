using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

/// <summary>
/// A saved address for a customer (home, parent's house, etc.)
/// with optional category-specific job details attached.
/// </summary>
public class CustomerAddress : BaseEntity
{
    public Guid CustomerProfileId { get; set; }
    public string Label { get; set; } = string.Empty; // "Home", "Mom's House", etc.
    public bool IsDefault { get; set; }

    // Address fields
    public string FormattedAddress { get; set; } = string.Empty;
    public string? Street { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? GooglePlaceId { get; set; } // For future Google Places integration

    // Job details associated with this address (yard size, etc.)
    public string? JobDetailsJson { get; set; }

    // Navigation
    public CustomerProfile CustomerProfile { get; set; } = null!;
}
