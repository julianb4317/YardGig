using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using YardGig.Application.Auth.Interfaces;
using YardGig.Application.Auth.Models;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Common.Models;

namespace YardGig.Infrastructure.Identity;

public class AuthService(
    UserManager<AppIdentityUser> userManager,
    SignInManager<AppIdentityUser> signInManager,
    IConfiguration configuration,
    ILogger<AuthService> logger,
    INotificationService notificationService,
    AppIdentityDbContext identityDb
) : IAuthService
{
    // signInManager reserved for cookie-based auth flows (server-rendered pages)
    private readonly SignInManager<AppIdentityUser> _signInManager = signInManager;
    private static readonly string[] ValidRoles = ["Customer", "Vendor", "Admin"];

    public async Task<Result<AuthResponse>> RegisterAsync(RegisterModel model, CancellationToken ct = default)
    {
        // Validate roles
        var roles = model.Roles.Where(r => ValidRoles.Contains(r, StringComparer.OrdinalIgnoreCase))
            .Select(r => char.ToUpper(r[0]) + r[1..].ToLower())
            .Distinct()
            .ToArray();

        if (roles.Length == 0)
            return Result<AuthResponse>.Failure("At least one valid role is required (Customer, Vendor).");

        if (roles.Contains("Admin"))
            return Result<AuthResponse>.Failure("Admin role cannot be self-assigned.");

        // Check existing
        var existing = await userManager.FindByEmailAsync(model.Email);
        if (existing is not null)
            return Result<AuthResponse>.Failure("An account with this email already exists.");

        var user = new AppIdentityUser
        {
            UserName = model.Email,
            Email = model.Email,
            DisplayName = model.DisplayName,
            EmailConfirmed = false,
            TwoFactorEnabled = false,
            IsActive = true
        };

        var result = await userManager.CreateAsync(user, model.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return Result<AuthResponse>.Failure(errors);
        }

        // Assign roles
        await userManager.AddToRolesAsync(user, roles);

        // Generate email confirmation token
        var confirmToken = await userManager.GenerateEmailConfirmationTokenAsync(user);
        // In production: send email with confirmation link
        logger.LogInformation("Email confirmation token for {Email}: {Token}", user.Email, confirmToken);

        await notificationService.SendEmailAsync(
            user.Email,
            "Confirm your YardGig account",
            $"<p>Welcome to YardGig! Please confirm your email using this token: <code>{confirmToken}</code></p>",
            ct);

        var response = new AuthResponse(
            AccessToken: string.Empty,
            RefreshToken: string.Empty,
            ExpiresAt: DateTime.UtcNow,
            UserId: user.Id,
            Roles: roles,
            RequiresEmailVerification: true
        );

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginModel model, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(model.Email);
        if (user is null)
            return Result<AuthResponse>.Failure("Invalid email or password.");

        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Account has been deactivated.");

        // Check lockout
        if (await userManager.IsLockedOutAsync(user))
            return Result<AuthResponse>.Failure("Account is locked. Try again later.");

        // Verify password
        var passwordValid = await userManager.CheckPasswordAsync(user, model.Password);
        if (!passwordValid)
        {
            await userManager.AccessFailedAsync(user);
            var remaining = await GetRemainingAttemptsAsync(user);
            return Result<AuthResponse>.Failure($"Invalid email or password. {remaining} attempts remaining.");
        }

        // Reset failed access count on successful password
        await userManager.ResetAccessFailedCountAsync(user);

        // Check email confirmed
        if (!user.EmailConfirmed)
        {
            return Result<AuthResponse>.Success(new AuthResponse(
                string.Empty, string.Empty, DateTime.UtcNow, user.Id, [],
                RequiresEmailVerification: true
            ));
        }

        // Check MFA
        if (user.TwoFactorEnabled)
        {
            if (string.IsNullOrEmpty(model.MfaCode))
            {
                return Result<AuthResponse>.Success(new AuthResponse(
                    string.Empty, string.Empty, DateTime.UtcNow, user.Id, [],
                    RequiresMfa: true
                ));
            }

            var mfaValid = await userManager.VerifyTwoFactorTokenAsync(
                user, userManager.Options.Tokens.AuthenticatorTokenProvider, model.MfaCode);

            if (!mfaValid)
                return Result<AuthResponse>.Failure("Invalid MFA code.");
        }

        return await GenerateAuthResponseAsync(user);
    }

    public async Task<Result<AuthResponse>> GoogleLoginAsync(string idToken, string[]? roles, CancellationToken ct = default)
    {
        // In production, validate the Google ID token using Google's token info endpoint
        // For now, assume the token is validated upstream (e.g., via Google Auth middleware)
        // This is a simplified flow — real implementation uses ExternalLoginInfo

        // Decode claims from Google ID token (simplified)
        var handler = new JwtSecurityTokenHandler();
        JwtSecurityToken? jwt;
        try
        {
            jwt = handler.ReadJwtToken(idToken);
        }
        catch
        {
            return Result<AuthResponse>.Failure("Invalid Google token.");
        }

        var email = jwt.Claims.FirstOrDefault(c => c.Type == "email")?.Value;
        var name = jwt.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
        var googleId = jwt.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(googleId))
            return Result<AuthResponse>.Failure("Could not extract user info from Google token.");

        var user = await userManager.FindByEmailAsync(email);

        if (user is null)
        {
            // Auto-register
            var selectedRoles = (roles ?? ["Customer"])
                .Where(r => ValidRoles.Contains(r, StringComparer.OrdinalIgnoreCase) && !r.Equals("Admin", StringComparison.OrdinalIgnoreCase))
                .Select(r => char.ToUpper(r[0]) + r[1..].ToLower())
                .Distinct()
                .ToArray();

            if (selectedRoles.Length == 0) selectedRoles = ["Customer"];

            user = new AppIdentityUser
            {
                UserName = email,
                Email = email,
                DisplayName = name ?? email,
                EmailConfirmed = true, // Google verifies email
                IsActive = true
            };

            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return Result<AuthResponse>.Failure(createResult.Errors.Select(e => e.Description).ToArray());

            await userManager.AddToRolesAsync(user, selectedRoles);

            // Link external login
            await userManager.AddLoginAsync(user, new UserLoginInfo("Google", googleId, "Google"));
        }
        else
        {
            // Ensure Google login is linked
            var logins = await userManager.GetLoginsAsync(user);
            if (!logins.Any(l => l.LoginProvider == "Google"))
            {
                await userManager.AddLoginAsync(user, new UserLoginInfo("Google", googleId, "Google"));
            }
        }

        return await GenerateAuthResponseAsync(user);
    }

    public async Task<Result> ConfirmEmailAsync(Guid userId, string token, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("User not found.");

        var result = await userManager.ConfirmEmailAsync(user, token);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(result.Errors.Select(e => e.Description).ToArray());
    }

    public async Task<Result> ResendConfirmationEmailAsync(string email, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null) return Result.Success(); // Don't reveal if email exists

        if (user.EmailConfirmed) return Result.Success();

        var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
        await notificationService.SendEmailAsync(
            email,
            "Confirm your YardGig account",
            $"<p>Your confirmation token: <code>{token}</code></p>",
            ct);

        return Result.Success();
    }

    public async Task<Result> EnableMfaAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("User not found.");

        await userManager.SetTwoFactorEnabledAsync(user, true);
        return Result.Success();
    }

    public async Task<Result<MfaSetupResponse>> GetMfaSetupInfoAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result<MfaSetupResponse>.Failure("User not found.");

        var unformattedKey = await userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(unformattedKey))
        {
            await userManager.ResetAuthenticatorKeyAsync(user);
            unformattedKey = await userManager.GetAuthenticatorKeyAsync(user);
        }

        var email = await userManager.GetEmailAsync(user);
        var qrCodeUri = $"otpauth://totp/YardGig:{UrlEncoder.Default.Encode(email!)}?secret={unformattedKey}&issuer=YardGig&digits=6";

        return Result<MfaSetupResponse>.Success(new MfaSetupResponse(unformattedKey!, qrCodeUri));
    }

    public async Task<Result<AuthResponse>> VerifyMfaAsync(Guid userId, string code, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result<AuthResponse>.Failure("User not found.");

        var isValid = await userManager.VerifyTwoFactorTokenAsync(
            user, userManager.Options.Tokens.AuthenticatorTokenProvider, code);

        if (!isValid) return Result<AuthResponse>.Failure("Invalid verification code.");

        await userManager.SetTwoFactorEnabledAsync(user, true);
        return await GenerateAuthResponseAsync(user);
    }

    public async Task<Result<string>> RefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        // In production, validate refresh token from DB/Redis
        // Simplified: decode the refresh token to get the user ID
        var user = await identityDb.Users
            .FirstOrDefaultAsync(u => u.SecurityStamp == refreshToken, ct);

        if (user is null) return Result<string>.Failure("Invalid refresh token.");

        var response = await GenerateAuthResponseAsync(user);
        return response.Succeeded
            ? Result<string>.Success(response.Data!.AccessToken)
            : Result<string>.Failure("Failed to refresh token.");
    }

    public async Task<Result> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        // In production, remove from refresh token store
        // For now, update security stamp to invalidate all tokens
        var user = await identityDb.Users
            .FirstOrDefaultAsync(u => u.SecurityStamp == refreshToken, ct);

        if (user is not null)
        {
            await userManager.UpdateSecurityStampAsync(user);
        }

        return Result.Success();
    }

    public async Task<Result> ForgotPasswordAsync(string email, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null) return Result.Success(); // Don't reveal email existence

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        await notificationService.SendEmailAsync(
            email,
            "Reset your YardGig password",
            $"<p>Your password reset token: <code>{token}</code></p>",
            ct);

        return Result.Success();
    }

    public async Task<Result> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null) return Result.Failure("Invalid request.");

        var result = await userManager.ResetPasswordAsync(user, token, newPassword);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(result.Errors.Select(e => e.Description).ToArray());
    }

    #region Private Helpers

    private async Task<Result<AuthResponse>> GenerateAuthResponseAsync(AppIdentityUser user)
    {
        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        var accessToken = GenerateJwtToken(user, roles);
        var refreshToken = GenerateRefreshToken();

        // Store refresh token (simplified — use Redis or DB in production)
        user.SecurityStamp = refreshToken;
        await userManager.UpdateAsync(user);

        var expiresAt = DateTime.UtcNow.AddMinutes(15);

        return Result<AuthResponse>.Success(new AuthResponse(
            accessToken, refreshToken, expiresAt, user.Id, roles
        ));
    }

    private string GenerateJwtToken(AppIdentityUser user, string[] roles)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key not configured")));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.Name, user.DisplayName),
            new("email_verified", user.EmailConfirmed.ToString().ToLower()),
            new("mfa_enabled", user.TwoFactorEnabled.ToString().ToLower())
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    private async Task<int> GetRemainingAttemptsAsync(AppIdentityUser user)
    {
        var maxAttempts = userManager.Options.Lockout.MaxFailedAccessAttempts;
        var failedCount = await userManager.GetAccessFailedCountAsync(user);
        return Math.Max(0, maxAttempts - failedCount);
    }

    #endregion
}
