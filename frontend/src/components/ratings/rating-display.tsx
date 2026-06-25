"use client";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { fetchRatings } from "@/lib/api/ratings";
import { Spinner } from "@/components/ui/spinner";

export function RatingStars({ score, count }: { score: number; count?: number }) {
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-1.5" aria-label={`Rating: ${score.toFixed(1)} out of 5`}>
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < fullStars
                ? "fill-yellow-400 text-yellow-400"
                : i === fullStars && hasHalf
                ? "fill-yellow-400/50 text-yellow-400"
                : "text-gray-200"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-sm font-medium text-gray-700">{score.toFixed(1)}</span>
      {count !== undefined && <span className="text-sm text-gray-400">({count})</span>}
    </div>
  );
}

export function ReviewsList({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ratings", userId],
    queryFn: () => fetchRatings(userId),
    enabled: !!userId,
  });

  if (isLoading) return <Spinner className="mx-auto my-4" />;
  if (!data || data.items.length === 0) {
    return <p className="text-sm text-gray-400 italic py-4">No reviews yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <RatingStars score={data.averageScore} count={data.totalCount} />
      </div>
      {data.items.map((r) => (
        <div key={r.id} className="border-b border-gray-100 pb-3 last:border-0">
          <div className="flex items-center gap-2">
            <RatingStars score={r.score} />
            <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-700">{r.reviewerName}</p>
          {r.comment && <p className="mt-0.5 text-sm text-gray-500">{r.comment}</p>}
          <p className="mt-0.5 text-xs text-gray-400">Job: {r.jobTitle}</p>
        </div>
      ))}
    </div>
  );
}
