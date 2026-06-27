using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Rakr.Application.Common.Interfaces;

namespace Rakr.Infrastructure.Services;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    public Guid? UserId
    {
        get
        {
            var id = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return id is not null ? Guid.Parse(id) : null;
        }
    }

    public string? Email => httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Email);

    public IReadOnlyList<string> Roles =>
        httpContextAccessor.HttpContext?.User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList()
        ?? [];
}
