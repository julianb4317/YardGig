using YardGig.Application.Auth.Models;
using YardGig.Application.Common.Models;

namespace YardGig.Application.Auth.Interfaces;

public interface IAuthService
{
    Task<Result<AuthResponse>> RegisterAsync(RegisterModel model, CancellationToken ct = default);
    Task<Result<AuthResponse>> LoginAsync(LoginModel model, CancellationToken ct = default);
    Task<Result<AuthResponse>> GoogleLoginAsync(string idToken, string[]? roles, CancellationToken ct = default);
    Task<Result> ConfirmEmailAsync(Guid userId, string token, CancellationToken ct = default);
    Task<Result> ResendConfirmationEmailAsync(string email, CancellationToken ct = default);
    Task<Result> EnableMfaAsync(Guid userId, CancellationToken ct = default);
    Task<Result<MfaSetupResponse>> GetMfaSetupInfoAsync(Guid userId, CancellationToken ct = default);
    Task<Result<AuthResponse>> VerifyMfaAsync(Guid userId, string code, CancellationToken ct = default);
    Task<Result<string>> RefreshTokenAsync(string refreshToken, CancellationToken ct = default);
    Task<Result> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default);
    Task<Result> ForgotPasswordAsync(string email, CancellationToken ct = default);
    Task<Result> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken ct = default);
}
