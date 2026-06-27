using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Rakr.Infrastructure.Hubs;

/// <summary>
/// SignalR hub for real-time map pin updates.
/// Vendors connect and receive new/removed pins in their area.
/// </summary>
[Authorize]
public class JobMapHub : Hub
{
    /// <summary>
    /// Vendor joins a geographic group to receive updates for their area.
    /// Group name is a geohash prefix for coarse spatial grouping.
    /// </summary>
    public async Task JoinArea(string geohashPrefix)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"area_{geohashPrefix}");
    }

    public async Task LeaveArea(string geohashPrefix)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"area_{geohashPrefix}");
    }
}
