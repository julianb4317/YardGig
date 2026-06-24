using Microsoft.AspNetCore.Identity;

namespace YardGig.Infrastructure.Identity;

public class AppIdentityRole : IdentityRole<Guid>
{
    public AppIdentityRole() { }
    public AppIdentityRole(string roleName) : base(roleName) { }
}
