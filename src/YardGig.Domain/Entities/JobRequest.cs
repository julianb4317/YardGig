using NetTopologySuite.Geometries;
using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

public class JobRequest : AggregateRoot
{
    public Guid CustomerProfileId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Categories { get; set; } = [];
    public string Address { get; set; } = string.Empty;
    public Point Location { get; set; } = null!; // SRID 4326
    public JobStatus Status { get; set; } = JobStatus.Open;
    public int BudgetCents { get; set; }
    public DateTime? ScheduleStart { get; set; }
    public DateTime? ScheduleEnd { get; set; }
    public List<string>? Photos { get; set; }
    public DateTime? ExpiresAt { get; set; }

    // Navigation
    public CustomerProfile CustomerProfile { get; set; } = null!;
    public ICollection<VendorRequest> VendorRequests { get; set; } = [];
    public JobAssignment? Assignment { get; set; }
    public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = [];
    public ICollection<Rating> Ratings { get; set; } = [];
    public Dispute? Dispute { get; set; }
}
