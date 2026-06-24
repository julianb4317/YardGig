using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class LedgerEntryConfiguration : IEntityTypeConfiguration<LedgerEntry>
{
    public void Configure(EntityTypeBuilder<LedgerEntry> builder)
    {
        builder.ToTable("LedgerEntries");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id).UseIdentityAlwaysColumn();
        builder.Property(l => l.EntryType).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Account).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Currency).HasMaxLength(3);
        builder.Property(l => l.IdempotencyKey).HasMaxLength(200);

        builder.HasIndex(l => l.IdempotencyKey).IsUnique()
            .HasFilter("\"IdempotencyKey\" IS NOT NULL");

        builder.HasIndex(l => l.PaymentTransactionId);
        builder.HasIndex(l => l.CreatedAt).IsDescending();

        builder.HasOne(l => l.PaymentTransaction)
            .WithMany()
            .HasForeignKey(l => l.PaymentTransactionId);
    }
}

public class CommissionConfigConfiguration : IEntityTypeConfiguration<CommissionConfig>
{
    public void Configure(EntityTypeBuilder<CommissionConfig> builder)
    {
        builder.ToTable("CommissionConfigs");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Scope).HasMaxLength(20).IsRequired();
        builder.Property(c => c.ScopeKey).HasMaxLength(200);
        builder.Property(c => c.Rate).HasPrecision(5, 4);

        builder.HasIndex(c => new { c.Scope, c.ScopeKey, c.IsActive })
            .HasDatabaseName("idx_commission_lookup");

        // Seed global default
        builder.HasData(new CommissionConfig
        {
            Id = Guid.Parse("20000000-0000-0000-0000-000000000001"),
            Scope = "global",
            ScopeKey = null,
            Rate = 0.15m,
            EffectiveFrom = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            IsActive = true,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });
    }
}

public class ProcessedWebhookEventConfiguration : IEntityTypeConfiguration<ProcessedWebhookEvent>
{
    public void Configure(EntityTypeBuilder<ProcessedWebhookEvent> builder)
    {
        builder.ToTable("ProcessedWebhookEvents");
        builder.HasKey(e => e.StripeEventId);

        builder.Property(e => e.StripeEventId).HasMaxLength(100);
        builder.Property(e => e.EventType).HasMaxLength(50).IsRequired();
    }
}
