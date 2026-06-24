using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YardGig.Application.Payments.Commands;

namespace YardGig.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PaymentsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Customer confirms job completion and triggers payment capture.
    /// </summary>
    [HttpPost("capture")]
    [Authorize(Policy = "CustomerOnly")]
    public async Task<IActionResult> CapturePayment([FromBody] CapturePaymentBody body)
    {
        var command = new CapturePaymentCommand(body.JobRequestId);
        var result = await mediator.Send(command);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new { transactionId = result.Data });
    }
}

public record CapturePaymentBody(Guid JobRequestId);
