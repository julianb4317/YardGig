namespace YardGig.Domain.Entities;

/// <summary>
/// Immutable record of user consent for legal documents and data processing.
/// Never updated — revocation creates a new record with Granted = false.
/// </summary>
public class ConsentRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string ConsentType { get; set; } = string.Empty; // terms_of_service, privacy_policy, etc.
    public string Version { get; set; } = string.Empty;     // Document version: "v1.0"
    public bool Granted { get; set; }
    public DateTime ConsentedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? DocumentHash { get; set; } // SHA-256 of the document version

    public ApplicationUser User { get; set; } = null!;
}
