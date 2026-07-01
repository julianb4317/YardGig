using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Enums;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfilesController(IAppDbContext db, ICurrentUserService currentUser, IGeocodingService geocoding) : ControllerBase
{
    /// <summary>
    /// Get the current user's vendor profile.
    /// </summary>
    [HttpGet("vendor/me")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> GetMyVendorProfile()
    {
        var profile = await db.VendorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId);

        if (profile is null)
        {
            return Ok(new
            {
                Id = (Guid?)null,
                BusinessName = (string?)null,
                Bio = (string?)null,
                ServiceCategories = Array.Empty<string>(),
                ServiceRadiusMiles = 15,
                Latitude = (double?)null,
                Longitude = (double?)null,
                VerificationStatus = "Pending",
                AverageRating = 0.0,
                TotalJobsCompleted = 0,
                BusinessAddress = (string?)null,
                BusinessLatitude = (double?)null,
                BusinessLongitude = (double?)null,
                InsuranceCarrier = (string?)null,
                InsuranceExpirationDate = (DateTime?)null,
                InsuranceLiabilityType = (string?)null,
                InsuranceLiabilityAmountCents = (int?)null,
                InsuranceDocUrl = (string?)null,
                InsuranceVerified = false,
                StripeOnboarded = false
            });
        }

        return Ok(new
        {
            profile.Id,
            profile.BusinessName,
            profile.Bio,
            profile.ServiceCategories,
            profile.ServiceRadiusMiles,
            Latitude = profile.HomeLocation?.Y,
            Longitude = profile.HomeLocation?.X,
            profile.VerificationStatus,
            profile.AverageRating,
            profile.TotalJobsCompleted,
            profile.BusinessAddress,
            profile.BusinessLatitude,
            profile.BusinessLongitude,
            profile.InsuranceCarrier,
            profile.InsuranceExpirationDate,
            profile.InsuranceLiabilityType,
            profile.InsuranceLiabilityAmountCents,
            profile.InsuranceDocUrl,
            profile.InsuranceVerified,
            profile.StripeOnboarded
        });
    }

    /// <summary>
    /// Update vendor profile.
    /// </summary>
    [HttpPut("vendor/me")]
    [Authorize(Policy = "VendorOnly")]
    public async Task<IActionResult> UpdateVendorProfile([FromBody] UpdateVendorProfileRequest request)
    {
        var profile = await db.VendorProfiles
            .FirstOrDefaultAsync(vp => vp.UserId == currentUser.UserId);

        if (profile is null) return NotFound();

        if (request.BusinessName is not null) profile.BusinessName = request.BusinessName;
        if (request.Bio is not null) profile.Bio = request.Bio;
        if (request.ServiceCategories is not null) profile.ServiceCategories = request.ServiceCategories.ToList();
        if (request.ServiceRadiusMiles.HasValue) profile.ServiceRadiusMiles = request.ServiceRadiusMiles.Value;
        if (request.InsuranceDocUrl is not null) profile.InsuranceDocUrl = request.InsuranceDocUrl;
        if (request.InsuranceCarrier is not null) profile.InsuranceCarrier = request.InsuranceCarrier;
        if (request.InsuranceExpirationDate.HasValue) profile.InsuranceExpirationDate = request.InsuranceExpirationDate.Value;
        if (request.InsuranceLiabilityType is not null) profile.InsuranceLiabilityType = request.InsuranceLiabilityType;
        if (request.InsuranceLiabilityAmountCents.HasValue) profile.InsuranceLiabilityAmountCents = request.InsuranceLiabilityAmountCents.Value;

        if (request.BusinessAddress is not null)
        {
            profile.BusinessAddress = request.BusinessAddress;
            var bizPoint = await geocoding.GeocodeAddressAsync(request.BusinessAddress);
            if (bizPoint is not null) { profile.BusinessLatitude = bizPoint.Y; profile.BusinessLongitude = bizPoint.X; }
        }

        if (request.Address is not null)
        {
            var point = await geocoding.GeocodeAddressAsync(request.Address);
            if (point is not null) profile.HomeLocation = point;
        }

        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Get the current user's customer profile.
    /// </summary>
    [HttpGet("customer/me")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> GetMyCustomerProfile()
    {
        var profile = await db.CustomerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId);

        if (profile is null)
        {
            return Ok(new
            {
                Id = (Guid?)null,
                BusinessName = (string?)null,
                DefaultAddress = (string?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                HasPaymentMethod = false
            });
        }

        // Check if any payment methods exist in the database
        var hasPaymentMethod = !string.IsNullOrEmpty(profile.StripeCustomerId)
            || await db.CustomerPaymentMethods.AnyAsync(pm => pm.CustomerProfileId == profile.Id);

        return Ok(new
        {
            profile.Id,
            profile.BusinessName,
            profile.DefaultAddress,
            Latitude = profile.DefaultLocation?.Y,
            Longitude = profile.DefaultLocation?.X,
            HasPaymentMethod = hasPaymentMethod
        });
    }

    /// <summary>
    /// Update customer profile.
    /// </summary>
    [HttpPut("customer/me")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> UpdateCustomerProfile([FromBody] UpdateCustomerProfileRequest request)
    {
        var profile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId);

        if (profile is null) return NotFound();

        if (request.BusinessName is not null) profile.BusinessName = request.BusinessName;

        if (request.DefaultAddress is not null)
        {
            profile.DefaultAddress = request.DefaultAddress;
            var point = await geocoding.GeocodeAddressAsync(request.DefaultAddress);
            if (point is not null) profile.DefaultLocation = point;
        }

        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Get a vendor's public profile (visible to customers).
    /// Does NOT expose private fields (address, insurance docs, Stripe ID).
    /// </summary>
    [HttpGet("vendor/{vendorProfileId:guid}")]
    public async Task<IActionResult> GetVendorPublicProfile(Guid vendorProfileId)
    {
        var profile = await db.VendorProfiles
            .AsNoTracking()
            .Include(vp => vp.User)
            .FirstOrDefaultAsync(vp => vp.Id == vendorProfileId);

        if (profile is null) return NotFound();

        // Calculate actual completed jobs count from assignments
        var actualJobsCompleted = await db.JobAssignments
            .CountAsync(ja => ja.VendorProfileId == vendorProfileId && ja.ConfirmedAt != null);

        var jobsCount = Math.Max(profile.TotalJobsCompleted, actualJobsCompleted);

        return Ok(new
        {
            profile.Id,
            UserId = profile.UserId,
            DisplayName = profile.User?.DisplayName ?? "Vendor",
            profile.BusinessName,
            profile.Bio,
            profile.ServiceCategories,
            profile.VerificationStatus,
            profile.AverageRating,
            TotalJobsCompleted = jobsCount,
            MemberSince = profile.CreatedAt,
            profile.InsuranceVerified
        });
    }

    /// <summary>
    /// Get completed jobs for a vendor (public job history).
    /// </summary>
    [HttpGet("vendor/{vendorProfileId:guid}/jobs")]
    public async Task<IActionResult> GetVendorJobHistory(
        Guid vendorProfileId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var jobs = await db.JobAssignments
            .AsNoTracking()
            .Include(ja => ja.JobRequest)
            .Where(ja => ja.VendorProfileId == vendorProfileId && ja.CompletedAt != null)
            .OrderByDescending(ja => ja.CompletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ja => new
            {
                ja.JobRequest.Id,
                ja.JobRequest.Title,
                ja.JobRequest.Categories,
                ja.JobRequest.BudgetCents,
                CompletedAt = ja.CompletedAt
            })
            .ToListAsync();

        var totalCount = await db.JobAssignments
            .CountAsync(ja => ja.VendorProfileId == vendorProfileId && ja.CompletedAt != null);

        return Ok(new { items = jobs, totalCount, page, pageSize });
    }
}

public record UpdateVendorProfileRequest(
    string? BusinessName,
    string? Bio,
    string[]? ServiceCategories,
    int? ServiceRadiusMiles,
    string? Address,
    string? InsuranceDocUrl,
    string? BusinessAddress,
    string? InsuranceCarrier,
    DateTime? InsuranceExpirationDate,
    string? InsuranceLiabilityType,
    int? InsuranceLiabilityAmountCents
);

public record UpdateCustomerProfileRequest(string? DefaultAddress, string? BusinessName = null);
