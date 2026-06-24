using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class DisputeConfiguration : IEntityTypeConfiguration<Dispute>
{
    public void Configure(EntityTypeBuilder<Dispute> builder)
    {
        builder.ToTable("Disputes");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Reason).IsRequired();

        builder.Property(d => d.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasIndex(d => new { d.Status, d.CreatedAt })
            .HasDatabaseName("idx_dispute_status")
            .HasFilter("\"Status\" IN ('Open', 'Investigating')");

        builder.HasOne(d => d.JobRequest)
            .WithOne(j => j.Dispute)
            .HasForeignKey<Dispute>(d => d.JobRequestId);

        builder.HasOne(d => d.RaisedBy)
            .WithMany()
            .HasForeignKey(d => d.RaisedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.ResolvedBy)
            .WithMany()
            .HasForeignKey(d => d.ResolvedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class DisputeNoteConfiguration : IEntityTypeConfiguration<DisputeNote>
{
    public void Configure(EntityTypeBuilder<DisputeNote> builder)
    {
        builder.ToTable("DisputeNotes");
        builder.HasKey(dn => dn.Id);

        builder.Property(dn => dn.Body).IsRequired();

        builder.HasOne(dn => dn.Dispute)
            .WithMany(d => d.Notes)
            .HasForeignKey(dn => dn.DisputeId);

        builder.HasOne(dn => dn.Author)
            .WithMany()
            .HasForeignKey(dn => dn.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
