namespace Rakr.Domain.Entities;

/// <summary>
/// A chat message between customer and vendor on a specific job.
/// </summary>
public class JobMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid JobRequestId { get; set; }
    public Guid SenderUserId { get; set; }
    public string Body { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }

    public JobRequest JobRequest { get; set; } = null!;
    public ApplicationUser Sender { get; set; } = null!;
}
