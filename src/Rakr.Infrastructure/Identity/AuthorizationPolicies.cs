using Microsoft.Extensions.DependencyInjection;

namespace Rakr.Infrastructure.Identity;

/// <summary>
/// Configures all authorization policies for the application.
/// Admin hierarchy: Owner > Admin > Support
/// </summary>
public static class AuthorizationPolicies
{
    public const string CustomerOnly = "CustomerOnly";
    public const string VendorOnly = "VendorOnly";
    public const string AdminOnly = "AdminOnly";         // Any admin-level (Support, Admin, Owner)
    public const string AdminWrite = "AdminWrite";       // Admin or Owner (write operations)
    public const string OwnerOnly = "OwnerOnly";         // Owner only (destructive / config)
    public const string AdminFinancial = "AdminFinancial"; // Admin or Owner (financial data)
    public const string CustomerOrVendor = "CustomerOrVendor";
    public const string EmailVerified = "EmailVerified";
    public const string MfaEnabled = "MfaEnabled";

    private static readonly string[] AdminRoles = ["Admin", "Owner"];
    private static readonly string[] AllAdminRoles = ["Support", "Admin", "Owner"];

    public static IServiceCollection AddAppAuthorization(this IServiceCollection services)
    {
        services.AddAuthorizationBuilder()
            .AddPolicy(CustomerOnly, policy =>
                policy.RequireRole("Customer"))

            .AddPolicy(VendorOnly, policy =>
                policy.RequireRole("Vendor"))

            .AddPolicy(AdminOnly, policy =>
                policy.RequireRole(AllAdminRoles)
                      .RequireClaim("email_verified", "true"))

            .AddPolicy(AdminWrite, policy =>
                policy.RequireRole(AdminRoles)
                      .RequireClaim("email_verified", "true"))

            .AddPolicy(OwnerOnly, policy =>
                policy.RequireRole("Owner")
                      .RequireClaim("email_verified", "true"))

            .AddPolicy(AdminFinancial, policy =>
                policy.RequireRole(AdminRoles)
                      .RequireClaim("email_verified", "true"))

            .AddPolicy(CustomerOrVendor, policy =>
                policy.RequireAssertion(ctx =>
                    ctx.User.IsInRole("Customer") || ctx.User.IsInRole("Vendor")))

            .AddPolicy(EmailVerified, policy =>
                policy.RequireClaim("email_verified", "true"))

            .AddPolicy(MfaEnabled, policy =>
                policy.RequireClaim("mfa_enabled", "true"));

        return services;
    }
}
