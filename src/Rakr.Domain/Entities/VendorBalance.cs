using Rakr.Domain.Common;

namespace Rakr.Domain.Entities;

/// <summary>
/// Tracks accumulated earnings for a vendor.
/// Increased on job payment, decreased on weekly payout.
/// </summary>
public class VendorBalance : BaseEntity
{
    public Guid VendorProfileId { get; set; }
    public int AvailableBalanceCents { get; set; }  // Ready for next payout
    public int PendingBalanceCents { get; set; }    // Held during dispute window
    public int LifetimeEarnedCents { get; set; }    // Running total (never decreases)
    public DateTime? LastPayoutAt { get; set; }

    public VendorProfile VendorProfile { get; set; } = null!;
}
