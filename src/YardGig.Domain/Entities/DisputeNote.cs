using YardGig.Domain.Common;

namespace YardGig.Domain.Entities;

public class DisputeNote : BaseEntity
{
    public Guid DisputeId { get; set; }
    public Guid AuthorId { get; set; }
    public string Body { get; set; } = string.Empty;

    // Navigation
    public Dispute Dispute { get; set; } = null!;
    public ApplicationUser Author { get; set; } = null!;
}
