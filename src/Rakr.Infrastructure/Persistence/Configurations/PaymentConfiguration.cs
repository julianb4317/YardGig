using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rakr.Domain.Entities;

namespace Rakr.Infrastructure.Persistence.Configurations;

public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> builder)
    {
        builder.ToTable("PaymentTransactions");
        builder.HasKey(pt => pt.Id);

        builder.Property(pt => pt.StripePaymentIntentId).HasMaxLength(100);
        builder.Property(pt => pt.StripeCustomerId).HasMaxLength(100);
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
        builder.Property(p => p.FailureReason).HasMaxLength(500);

        builder.Property(p => p.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasIndex(p => new { p.VendorProfileId, p.Status })
            .HasDatabaseName("idx_payout_vendor_status");

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

public class VendorBalanceConfiguration : IEntityTypeConfiguration<VendorBalance>
{
    public void Configure(EntityTypeBuilder<VendorBalance> builder)
    {
        builder.ToTable("VendorBalances");
        builder.HasKey(vb => vb.Id);

        builder.HasIndex(vb => vb.VendorProfileId).IsUnique();

        builder.HasOne(vb => vb.VendorProfile)
            .WithOne()
            .HasForeignKey<VendorBalance>(vb => vb.VendorProfileId);
    }
}

public class CustomerPaymentMethodConfiguration : IEntityTypeConfiguration<CustomerPaymentMethod>
{
    public void Configure(EntityTypeBuilder<CustomerPaymentMethod> builder)
    {
        builder.ToTable("CustomerPaymentMethods");
        builder.HasKey(pm => pm.Id);

        builder.Property(pm => pm.StripePaymentMethodId).HasMaxLength(100).IsRequired();
        builder.Property(pm => pm.StripeCustomerId).HasMaxLength(100).IsRequired();
        builder.Property(pm => pm.CardLast4).HasMaxLength(4);
        builder.Property(pm => pm.CardBrand).HasMaxLength(20);

        builder.HasIndex(pm => pm.CustomerProfileId);

        builder.HasOne(pm => pm.CustomerProfile)
            .WithMany()
            .HasForeignKey(pm => pm.CustomerProfileId);
    }
}

public class EscrowTransactionConfiguration : IEntityTypeConfiguration<Rakr.Domain.Entities.EscrowTransaction>
{
    public void Configure(EntityTypeBuilder<Rakr.Domain.Entities.EscrowTransaction> builder)
    {
        builder.ToTable("EscrowTransactions");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.StripePaymentIntentId).HasMaxLength(100);
        builder.Property(e => e.Currency).HasMaxLength(3);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);

        builder.HasIndex(e => new { e.JobRequestId, e.Status });

        builder.HasOne(e => e.JobRequest).WithMany().HasForeignKey(e => e.JobRequestId);
        builder.HasOne(e => e.CustomerProfile).WithMany().HasForeignKey(e => e.CustomerProfileId);
    }
}
