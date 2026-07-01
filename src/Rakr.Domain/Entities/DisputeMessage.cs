using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

/// <summary>
/// Chat message within a dispute — between the disputer and admin.
/// Same pattern as JobMessage.
/// </summary>
public class DisputeMessage : BaseEntity
{
    public Guid DisputeId { get; set; }
    public Guid SenderUserId { get; set; }
    public string Body { get; set; } = string.Empty;
    public bool IsRead { get; set; }

    // Navigation
    public Dispute Dispute { get; set; } = null!;
    public ApplicationUser Sender { get; set; } = null!;
}
