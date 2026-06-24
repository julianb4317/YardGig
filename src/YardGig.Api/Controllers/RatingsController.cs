using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YardGig.Application.Ratings.Commands;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RatingsController(IMediator mediator) : ControllerBase
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
}
