using YardGig.Domain.Common;
using YardGig.Domain.Enums;

namespace YardGig.Domain.Entities;

/// <summary>
/// Represents a recurring job series — the "subscription" wrapper that spawns
/// individual JobRequest instances on schedule.
/// </summary>
public class RecurringJobSeries : BaseEntity
{
    public Guid CustomerProfileId { get; set; }
    public Guid TemplateJobId { get; set; } // The original job that serves as template
    public Guid? AssignedVendorProfileId { get; set; }

    // Schedule
    public string Frequency { get; set; } = "weekly"; // weekly, biweekly, monthly
    public List<string> Days { get; set; } = []; // ["Monday", "Wednesday"]
    public string Time { get; set; } = "09:00"; // HH:mm

    // State
    public RecurringSeriesStatus Status { get; set; } = RecurringSeriesStatus.Active;
    public DateTime? NextOccurrence { get; set; }
    public DateTime? LastSpawnedAt { get; set; }
    public int TotalOccurrences { get; set; }

    // Navigation
    public CustomerProfile CustomerProfile { get; set; } = null!;
    public JobRequest TemplateJob { get; set; } = null!;
    public VendorProfile? AssignedVendorProfile { get; set; }
}
