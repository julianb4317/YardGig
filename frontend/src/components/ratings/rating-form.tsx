"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";

interface RatingFormProps {
  jobId: string;
  revieweeId: string;
  revieweeName: string;
}

/**
 * Star rating + comment form.
 * Uses existing POST /api/ratings endpoint.
 */
export function RatingForm({ jobId, revieweeId, revieweeName }: RatingFormProps) {
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiClient<{ ratingId: string }>("/api/ratings", {
        method: "POST",
        body: { jobRequestId: jobId, revieweeId, score, comment: comment || undefined },
      }),
    onSuccess: () => {
      toast.success("Rating submitted!");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to submit rating.");
    },
  });

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700">Rate {revieweeName}</h4>

      {/* Star selector */}
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating score">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScore(s)}
            onMouseEnter={() => setHoverScore(s)}
            onMouseLeave={() => setHoverScore(0)}
            className="p-0.5"
            aria-label={`${s} star${s > 1 ? "s" : ""}`}
            aria-checked={score === s}
            role="radio"
          >
            <Star
              className={`h-6 w-6 transition ${
                s <= (hoverScore || score)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-200"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment..."
        rows={2}
        maxLength={500}
        className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      <button
        onClick={() => mutation.mutate()}
        disabled={score === 0 || mutation.isPending}
        className="mt-3 flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
        Submit Rating
      </button>
    </div>
  );
}
