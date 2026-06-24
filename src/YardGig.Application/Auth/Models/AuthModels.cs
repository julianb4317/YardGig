namespace YardGig.Application.Auth.Models;

public record RegisterModel(
    string Email,
    string Password,
    string DisplayName,
    string[] Roles // ["Customer"], ["Vendor"], or ["Customer", "Vendor"]
);

public record LoginModel(string Email, string Password, string? MfaCode = null);

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    Guid UserId,
    string[] Roles,
    bool RequiresMfa = false,
    bool RequiresEmailVerification = false
);

public record MfaSetupResponse(
    string SharedKey,
    string QrCodeUri
);
