using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using YardGig.Application.Auth.Interfaces;
using YardGig.Application.Auth.Models;
using YardGig.Application.Common.Interfaces;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("AuthLimiter")]
public class AuthController(IAuthService authService, ICurrentUserService currentUser) : ControllerBase
{
    /// <summary>
    /// Register a new user with email/password. 
    /// Roles can be ["Customer"], ["Vendor"], or ["Customer", "Vendor"].
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var model = new RegisterModel(request.Email, request.Password, request.DisplayName, request.Roles);
        var result = await authService.RegisterAsync(model);

        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        return Ok(new
        {
            result.Data!.UserId,
            result.Data.Roles,
            message = "Registration successful. Please check your email to verify your account."
        });
    }

    /// <summary>
    /// Login with email/password. Returns JWT if successful.
    /// If MFA is enabled, pass mfaCode in the request body.
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var model = new LoginModel(request.Email, request.Password, request.MfaCode);
        var result = await authService.LoginAsync(model);

        if (!result.Succeeded)
            return Unauthorized(new { errors = result.Errors });

        if (result.Data!.RequiresEmailVerification)
            return Ok(new { requiresEmailVerification = true, result.Data.UserId });

        if (result.Data.RequiresMfa)
            return Ok(new { requiresMfa = true, result.Data.UserId });

        return Ok(new
        {
            result.Data.AccessToken,
            result.Data.RefreshToken,
            result.Data.ExpiresAt,
            result.Data.UserId,
            result.Data.Roles
        });
    }

    /// <summary>
    /// Login/register via Google OAuth. Pass the Google ID token.
    /// </summary>
    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        var result = await authService.GoogleLoginAsync(request.IdToken, request.Roles);

        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        return Ok(new
        {
            result.Data!.AccessToken,
            result.Data.RefreshToken,
            result.Data.ExpiresAt,
            result.Data.UserId,
            result.Data.Roles
        });
    }

    /// <summary>
    /// Confirm email address with the token sent via email.
    /// </summary>
    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request)
    {
        var result = await authService.ConfirmEmailAsync(request.UserId, request.Token);
        return result.Succeeded ? Ok(new { message = "Email confirmed." }) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>
    /// Resend email confirmation link.
    /// </summary>
    [HttpPost("resend-confirmation")]
    public async Task<IActionResult> ResendConfirmation([FromBody] ResendConfirmationRequest request)
    {
        await authService.ResendConfirmationEmailAsync(request.Email);
        return Ok(new { message = "If the email exists, a confirmation link has been sent." });
    }

    /// <summary>
    /// Get MFA setup information (authenticator key + QR code URI).
    /// </summary>
    [HttpGet("mfa/setup")]
    [Authorize]
    public async Task<IActionResult> GetMfaSetup()
    {
        if (currentUser.UserId is null) return Unauthorized();

        var result = await authService.GetMfaSetupInfoAsync(currentUser.UserId.Value);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });

        return Ok(new { result.Data!.SharedKey, result.Data.QrCodeUri });
    }

    /// <summary>
    /// Verify MFA code and enable 2FA on the account.
    /// </summary>
    [HttpPost("mfa/verify")]
    [Authorize]
    public async Task<IActionResult> VerifyMfa([FromBody] VerifyMfaRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var result = await authService.VerifyMfaAsync(currentUser.UserId.Value, request.Code);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });

        return Ok(new { message = "MFA enabled successfully.", result.Data!.AccessToken });
    }

    /// <summary>
    /// Refresh the access token using a refresh token.
    /// </summary>
    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await authService.RefreshTokenAsync(request.RefreshToken);
        if (!result.Succeeded) return Unauthorized(new { errors = result.Errors });

        return Ok(new { accessToken = result.Data });
    }

    /// <summary>
    /// Revoke a refresh token (logout).
    /// </summary>
    [HttpPost("revoke")]
    [Authorize]
    public async Task<IActionResult> RevokeToken([FromBody] RefreshTokenRequest request)
    {
        await authService.RevokeRefreshTokenAsync(request.RefreshToken);
        return Ok(new { message = "Token revoked." });
    }

    /// <summary>
    /// Request a password reset email.
    /// </summary>
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        await authService.ForgotPasswordAsync(request.Email);
        return Ok(new { message = "If the email exists, a reset link has been sent." });
    }

    /// <summary>
    /// Reset password with the token from email.
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var result = await authService.ResetPasswordAsync(request.Email, request.Token, request.NewPassword);
        return result.Succeeded
            ? Ok(new { message = "Password reset successful." })
            : BadRequest(new { errors = result.Errors });
    }
}

// Request DTOs
public record RegisterRequest(string Email, string Password, string DisplayName, string[] Roles);
public record LoginRequest(string Email, string Password, string? MfaCode = null);
public record GoogleLoginRequest(string IdToken, string[]? Roles = null);
public record ConfirmEmailRequest(Guid UserId, string Token);
public record ResendConfirmationRequest(string Email);
public record VerifyMfaRequest(string Code);
public record RefreshTokenRequest(string RefreshToken);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
