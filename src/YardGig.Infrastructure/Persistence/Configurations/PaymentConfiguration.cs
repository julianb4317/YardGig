using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> builder)
    {
        builder.ToTable("PaymentTransactions");
        builder.HasKey(pt => pt.Id);

        builder.Property(pt => pt.StripePaymentIntentId).HasMaxLength(100);
        builder.Property(pt => pt.Currency).HasMaxLength(3);

        builder.Property(pt => pt.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasIndex(pt => pt.JobRequestId)
            .HasDatabaseName("idx_payment_job");

        builder.HasOne(pt => pt.JobRequest)
            .WithMany(j => j.PaymentTransactions)
            .HasForeignKey(pt => pt.JobRequestId);
    }
}

public class PayoutConfiguration : IEntityTypeConfiguration<Payout>
{
    public void Configure(EntityTypeBuilder<Payout> builder)
    {
        builder.ToTable("Payouts");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.StripeTransferId).HasMaxLength(100);

        builder.Property(p => p.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasOne(p => p.PaymentTransaction)
            .WithOne(pt => pt.Payout)
            .HasForeignKey<Payout>(p => p.PaymentTransactionId);

        builder.HasOne(p => p.VendorProfile)
            .WithMany()
            .HasForeignKey(p => p.VendorProfileId);
    }
}

public class PlatformFeeLedgerConfiguration : IEntityTypeConfiguration<PlatformFeeLedger>
{
    public void Configure(EntityTypeBuilder<PlatformFeeLedger> builder)
    {
        builder.ToTable("PlatformFeeLedger");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.EntryType).HasMaxLength(20).IsRequired();

        builder.HasOne(l => l.PaymentTransaction)
            .WithOne(pt => pt.FeeLedgerEntry)
            .HasForeignKey<PlatformFeeLedger>(l => l.PaymentTransactionId);
    }
}
