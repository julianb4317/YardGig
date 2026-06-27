using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

public class Rating : BaseEntity
{
    public Guid JobRequestId { get; set; }
    public Guid ReviewerId { get; set; }
    public Guid RevieweeId { get; set; }
    public int Score { get; set; } // 1-5
    public string? Comment { get; set; }

    // Navigation
    public JobRequest JobRequest { get; set; } = null!;
    public ApplicationUser Reviewer { get; set; } = null!;
    public ApplicationUser Reviewee { get; set; } = null!;
}
