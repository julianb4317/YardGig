using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Ratings.Commands;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RatingsController(IMediator mediator, IAppDbContext db) : ControllerBase
{
    /// <summary>
    /// Submit a rating for a completed job.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateRating([FromBody] CreateRatingCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new { ratingId = result.Data });
    }

    /// <summary>
    /// Get ratings for a specific user (public).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRatings(
        [FromQuery] Guid revieweeId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = db.Ratings
            .AsNoTracking()
            .Include(r => r.Reviewer)
            .Include(r => r.JobRequest)
            .Where(r => r.RevieweeId == revieweeId);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.JobRequestId,
                JobTitle = r.JobRequest.Title,
                r.ReviewerId,
                ReviewerName = r.Reviewer.DisplayName,
                r.Score,
                r.Comment,
                r.CreatedAt
            })
            .ToListAsync();

        var averageScore = totalCount > 0
            ? await db.Ratings.Where(r => r.RevieweeId == revieweeId).AverageAsync(r => (double)r.Score)
            : 0.0;

        return Ok(new { items, totalCount, averageScore, page, pageSize });
    }
}
