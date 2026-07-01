using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Rakr.Api.Filters;

public class GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var ex = context.Exception;
        var inner = ex;
        while (inner.InnerException != null) inner = inner.InnerException;

        logger.LogError(ex, "Unhandled exception in {Controller}/{Action}: {RootCause}",
            context.RouteData.Values["controller"],
            context.RouteData.Values["action"],
            inner.Message);

        context.Result = new ObjectResult(new { errors = new[] { "An unexpected error occurred. Please try again." } })
        {
            StatusCode = 500
        };
        context.ExceptionHandled = true;
    }
}
