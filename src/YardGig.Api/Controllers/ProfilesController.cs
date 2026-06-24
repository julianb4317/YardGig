using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using YardGig.Application.Common.Interfaces;
using YardGig.Domain.Enums;

namespace YardGig.Api.Controllers;

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

        if (profile is null) return NotFound();

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
            profile.TotalJobsCompleted
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

        if (request.Address is not null)
        {
            var point = await geocoding.GeocodeAddressAsync(request.Address);
            if (point is not null) profile.HomeLocation = point;
        }

        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok();
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

        if (profile is null) return NotFound();

        return Ok(new
        {
            profile.Id,
            profile.DefaultAddress,
            Latitude = profile.DefaultLocation?.Y,
            Longitude = profile.DefaultLocation?.X,
            HasPaymentMethod = !string.IsNullOrEmpty(profile.StripeCustomerId)
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

        if (request.DefaultAddress is not null)
        {
            profile.DefaultAddress = request.DefaultAddress;
            var point = await geocoding.GeocodeAddressAsync(request.DefaultAddress);
            if (point is not null) profile.DefaultLocation = point;
        }

        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok();
    }
}

public record UpdateVendorProfileRequest(
    string? BusinessName,
    string? Bio,
    string[]? ServiceCategories,
    int? ServiceRadiusMiles,
    string? Address,
    string? InsuranceDocUrl
);

public record UpdateCustomerProfileRequest(string? DefaultAddress);
