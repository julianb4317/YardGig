using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rakr.Application.Common.Interfaces;
using Rakr.Domain.Entities;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/customer/addresses")]
[Authorize(Policy = "CustomerOnly")]
public class CustomerAddressesController(IAppDbContext db, ICurrentUserService currentUser, IGeocodingService geocoding) : ControllerBase
{
    /// <summary>
    /// Get all saved addresses for the current customer.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAddresses()
    {
        if (currentUser.UserId is null) return Unauthorized();

        var profile = await db.CustomerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);

        if (profile is null) return Ok(Array.Empty<object>());

        var addresses = await db.CustomerAddresses
            .AsNoTracking()
            .Where(a => a.CustomerProfileId == profile.Id)
            .OrderByDescending(a => a.IsDefault)
            .ThenBy(a => a.Label)
            .Select(a => new
            {
                a.Id,
                a.Label,
                a.IsDefault,
                a.FormattedAddress,
                a.Street,
                a.City,
                a.State,
                a.Zip,
                a.Latitude,
                a.Longitude,
                a.JobDetailsJson,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(addresses);
    }

    /// <summary>
    /// Add a new address.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> AddAddress([FromBody] AddAddressBody body)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var profile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);

        if (profile is null)
            return BadRequest(new { errors = new[] { "Customer profile not found. Please complete registration." } });

        // If this is the first address or marked default, unset other defaults
        var existingCount = await db.CustomerAddresses.CountAsync(a => a.CustomerProfileId == profile.Id);
        var shouldBeDefault = body.IsDefault || existingCount == 0;

        if (shouldBeDefault)
        {
            var currentDefaults = await db.CustomerAddresses
                .Where(a => a.CustomerProfileId == profile.Id && a.IsDefault)
                .ToListAsync();
            foreach (var d in currentDefaults) d.IsDefault = false;
        }

        // Geocode the address
        double? lat = null, lng = null;
        var point = await geocoding.GeocodeAddressAsync(body.FormattedAddress);
        if (point != null)
        {
            lat = point.Y;
            lng = point.X;
        }

        var address = new CustomerAddress
        {
            CustomerProfileId = profile.Id,
            Label = body.Label,
            IsDefault = shouldBeDefault,
            FormattedAddress = body.FormattedAddress,
            Street = body.Street,
            City = body.City,
            State = body.State,
            Zip = body.Zip,
            Latitude = lat,
            Longitude = lng,
            JobDetailsJson = body.JobDetailsJson,
        };

        db.CustomerAddresses.Add(address);
        await db.SaveChangesAsync();

        return Ok(new { id = address.Id, address.IsDefault });
    }

    /// <summary>
    /// Update an existing address.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateAddress(Guid id, [FromBody] UpdateAddressBody body)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var profile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);
        if (profile is null) return NotFound(new { errors = new[] { "Profile not found." } });

        var address = await db.CustomerAddresses
            .FirstOrDefaultAsync(a => a.Id == id && a.CustomerProfileId == profile.Id);
        if (address is null) return NotFound(new { errors = new[] { "Address not found." } });

        if (body.Label is not null) address.Label = body.Label;
        if (body.FormattedAddress is not null)
        {
            address.FormattedAddress = body.FormattedAddress;
            var point = await geocoding.GeocodeAddressAsync(body.FormattedAddress);
            if (point != null) { address.Latitude = point.Y; address.Longitude = point.X; }
        }
        if (body.Street is not null) address.Street = body.Street;
        if (body.City is not null) address.City = body.City;
        if (body.State is not null) address.State = body.State;
        if (body.Zip is not null) address.Zip = body.Zip;
        if (body.JobDetailsJson is not null) address.JobDetailsJson = body.JobDetailsJson;

        if (body.IsDefault == true && !address.IsDefault)
        {
            var others = await db.CustomerAddresses
                .Where(a => a.CustomerProfileId == profile.Id && a.IsDefault)
                .ToListAsync();
            foreach (var o in others) o.IsDefault = false;
            address.IsDefault = true;
        }

        address.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Delete an address.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAddress(Guid id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var profile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);
        if (profile is null) return NotFound(new { errors = new[] { "Profile not found." } });

        var address = await db.CustomerAddresses
            .FirstOrDefaultAsync(a => a.Id == id && a.CustomerProfileId == profile.Id);
        if (address is null) return NotFound(new { errors = new[] { "Address not found." } });

        db.CustomerAddresses.Remove(address);
        await db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Set an address as default.
    /// </summary>
    [HttpPut("{id:guid}/default")]
    public async Task<IActionResult> SetDefault(Guid id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var profile = await db.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == currentUser.UserId.Value);
        if (profile is null) return NotFound(new { errors = new[] { "Profile not found." } });

        var address = await db.CustomerAddresses
            .FirstOrDefaultAsync(a => a.Id == id && a.CustomerProfileId == profile.Id);
        if (address is null) return NotFound(new { errors = new[] { "Address not found." } });

        // Unset all others
        var others = await db.CustomerAddresses
            .Where(a => a.CustomerProfileId == profile.Id && a.IsDefault)
            .ToListAsync();
        foreach (var o in others) o.IsDefault = false;

        address.IsDefault = true;
        await db.SaveChangesAsync();

        return Ok(new { success = true });
    }
}

public record AddAddressBody(
    string Label,
    string FormattedAddress,
    string? Street = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    bool IsDefault = false,
    string? JobDetailsJson = null
);

public record UpdateAddressBody(
    string? Label = null,
    string? FormattedAddress = null,
    string? Street = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    bool? IsDefault = null,
    string? JobDetailsJson = null
);
