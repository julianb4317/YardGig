using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using YardGig.Domain.Entities;

namespace YardGig.Infrastructure.Persistence.Configurations;

public class RatingConfiguration : IEntityTypeConfiguration<Rating>
{
    public void Configure(EntityTypeBuilder<Rating> builder)
    {
        builder.ToTable("Ratings");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Score).IsRequired();

        // One rating per reviewer per job
        builder.HasIndex(r => new { r.JobRequestId, r.ReviewerId }).IsUnique();

        builder.HasIndex(r => r.RevieweeId)
            .HasDatabaseName("idx_rating_reviewee");

        builder.HasOne(r => r.JobRequest)
            .WithMany(j => j.Ratings)
            .HasForeignKey(r => r.JobRequestId);

        builder.HasOne(r => r.Reviewer)
            .WithMany()
            .HasForeignKey(r => r.ReviewerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Reviewee)
            .WithMany()
            .HasForeignKey(r => r.RevieweeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
