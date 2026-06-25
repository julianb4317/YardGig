using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YardGig.Application.Common.Interfaces;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UploadsController(IConfiguration configuration, ICurrentUserService currentUser) : ControllerBase
{
    private static readonly HashSet<string> AllowedContentTypes =
    [
        "image/jpeg", "image/png", "image/webp", "image/heic",
        "application/pdf" // insurance docs
    ];

    private static readonly HashSet<string> AllowedPurposes = ["job_photo", "insurance_doc", "avatar"];
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    /// <summary>
    /// Generate a presigned upload URL for S3-compatible storage.
    /// Client uploads directly to the returned URL, then uses the fileUrl in subsequent API calls.
    /// </summary>
    [HttpPost("presign")]
    public IActionResult GetPresignedUrl([FromBody] PresignRequest request)
    {
        if (currentUser.UserId is null) return Unauthorized();

        if (!AllowedContentTypes.Contains(request.ContentType))
            return BadRequest(new { errors = new[] { $"Content type '{request.ContentType}' not allowed. Use JPEG, PNG, WebP, or PDF." } });

        if (!AllowedPurposes.Contains(request.Purpose))
            return BadRequest(new { errors = new[] { $"Invalid purpose. Use: {string.Join(", ", AllowedPurposes)}" } });

        // Sanitize filename
        var safeFileName = SanitizeFileName(request.FileName);
        var key = $"{request.Purpose}/{currentUser.UserId}/{Guid.NewGuid():N}_{safeFileName}";

        var baseUrl = configuration["Storage:BaseUrl"] ?? "https://storage.yardgig.com";
        var cdnUrl = configuration["Storage:CdnUrl"] ?? baseUrl;

        // In production: generate actual S3 presigned PUT URL using AWS SDK
        // For development: return a mock URL that the frontend can use
        var uploadUrl = $"{baseUrl}/uploads/{key}?X-Amz-Expires=300";
        var fileUrl = $"{cdnUrl}/{key}";

        return Ok(new
        {
            uploadUrl,
            fileUrl,
            key,
            expiresIn = 300, // seconds
            maxSizeBytes = MaxFileSizeBytes
        });
    }

    private static string SanitizeFileName(string fileName)
    {
        // Remove path separators and limit length
        var name = Path.GetFileName(fileName);
        name = string.Concat(name.Where(c => char.IsLetterOrDigit(c) || c == '.' || c == '-' || c == '_'));
        return name.Length > 100 ? name[..100] : name;
    }
}

public record PresignRequest(string FileName, string ContentType, string Purpose);
