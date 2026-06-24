using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/vendors/stripe")]
[Authorize(Policy = "VendorOnly")]
public class VendorPaymentsController(
    IAppDbContext db,
    IPaymentService paymentService,
    ICurrentUserService currentUser,
    IConfiguration configuration
) : ControllerBase
{
    /// <summary>
    /// Start Stripe Connect onboarding for the vendor.
    /// Creates a connected Express account and returns the onboarding URL.
    /// </summary>
    [HttpPost("onboard")]
    public async Task<IActionResult> StartOnboarding()
    {
        var vendor = await db.VendorProfiles
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => v.UserId == currentUser.UserId);

        if (vendor is null) return NotFound("Vendor profile not found.");

        // If already onboarded, return dashboard link
        if (!string.IsNullOrEmpty(vendor.StripeAccountId))
        {
            var status = await paymentService.GetAccountStatusAsync(vendor.StripeAccountId);
            if (status.DetailsSubmitted)
                return Ok(new { alreadyOnboarded = true, message = "Account already set up." });

            // Resume onboarding
            var resumeUrl = await paymentService.CreateAccountLinkAsync(
                vendor.StripeAccountId,
                $"{configuration["App:BaseUrl"]}/vendor/stripe/return",
                $"{configuration["App:BaseUrl"]}/vendor/stripe/refresh");

            return Ok(new { onboardingUrl = resumeUrl });
        }

        // Create new connected account
        var accountId = await paymentService.CreateConnectedAccountAsync(
            vendor.User.Email, vendor.BusinessName ?? vendor.User.DisplayName);

        vendor.StripeAccountId = accountId;
        vendor.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // Generate onboarding link
        var onboardingUrl = await paymentService.CreateAccountLinkAsync(
            accountId,
            $"{configuration["App:BaseUrl"]}/vendor/stripe/return",
            $"{configuration["App:BaseUrl"]}/vendor/stripe/refresh");

        return Ok(new { accountId, onboardingUrl });
    }

    /// <summary>
    /// Get the vendor's Stripe account status.
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var vendor = await db.VendorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.UserId == currentUser.UserId);

        if (vendor is null) return NotFound();

        if (string.IsNullOrEmpty(vendor.StripeAccountId))
            return Ok(new { onboarded = false, chargesEnabled = false, payoutsEnabled = false });

        var status = await paymentService.GetAccountStatusAsync(vendor.StripeAccountId);

        return Ok(new
        {
            onboarded = true,
            status.ChargesEnabled,
            status.PayoutsEnabled,
            status.DetailsSubmitted
        });
    }

    /// <summary>
    /// Get a login link to the vendor's Stripe Express dashboard.
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboardLink()
    {
        var vendor = await db.VendorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.UserId == currentUser.UserId);

        if (vendor is null || string.IsNullOrEmpty(vendor.StripeAccountId))
            return BadRequest("Stripe account not set up.");

        var url = await paymentService.CreateDashboardLinkAsync(vendor.StripeAccountId);
        return Ok(new { dashboardUrl = url });
    }
}
