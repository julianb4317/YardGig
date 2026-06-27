using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Rakr.Application.Common.Interfaces;

namespace Rakr.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UploadsController(IConfiguration configuration, ICurrentUserService currentUser, IWebHostEnvironment env) : ControllerBase
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

        var baseUrl = configuration["Storage:BaseUrl"] ?? "https://storage.Rakr.com";
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

    /// <summary>
    /// Direct file upload endpoint (dev/local mode).
    /// Accepts multipart form data, saves to local storage, returns URLs.
    /// In production, use presigned URLs + S3 instead.
    /// </summary>
    [HttpPost("files")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB total for batch
    public async Task<IActionResult> UploadFiles([FromForm] List<IFormFile> files, [FromForm] string purpose = "job_photo")
    {
        if (currentUser.UserId is null) return Unauthorized();

        if (!AllowedPurposes.Contains(purpose))
            return BadRequest(new { errors = new[] { $"Invalid purpose. Use: {string.Join(", ", AllowedPurposes)}" } });

        if (files.Count == 0)
            return BadRequest(new { errors = new[] { "No files provided." } });

        if (files.Count > 5)
            return BadRequest(new { errors = new[] { "Maximum 5 files per upload." } });

        var uploadedUrls = new List<string>();

        foreach (var file in files)
        {
            if (file.Length == 0) continue;
            if (file.Length > MaxFileSizeBytes)
                return BadRequest(new { errors = new[] { $"File '{file.FileName}' exceeds 10 MB limit." } });

            if (!AllowedContentTypes.Contains(file.ContentType))
                return BadRequest(new { errors = new[] { $"File type '{file.ContentType}' not allowed." } });

            var safeFileName = SanitizeFileName(file.FileName);
            var uniqueName = $"{Guid.NewGuid():N}_{safeFileName}";
            var relativePath = Path.Combine("uploads", purpose, currentUser.UserId.Value.ToString(), uniqueName);
            var fullPath = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), relativePath);

            // Ensure directory exists
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

            await using var stream = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(stream);

            // Build URL relative to the API base
            var fileUrl = $"/uploads/{purpose}/{currentUser.UserId.Value}/{uniqueName}";
            uploadedUrls.Add(fileUrl);
        }

        return Ok(new { urls = uploadedUrls });
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
