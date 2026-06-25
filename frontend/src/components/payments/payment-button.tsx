"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DollarSign, Star } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCents } from "@/lib/utils";

interface PaymentButtonProps {
  jobId: string;
  budgetCents: number;
  assignedVendorId?: string;
  assignedVendorName?: string;
}

export function PaymentButton({ jobId, budgetCents, assignedVendorId, assignedVendorName }: PaymentButtonProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [hoverStar, setHoverStar] = useState(0);

  const chargeMutation = useMutation({
    mutationFn: () =>
      apiClient<{ transactionId: string } | { message: string; alreadyPaid: boolean }>("/api/payments/charge", {
        method: "POST",
        body: { jobRequestId: jobId },
      }),
    onSuccess: () => {
      toast.success("Payment processed! Vendor will receive their payout.");
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      // Open rating modal
      if (assignedVendorId) {
        setRatingOpen(true);
      }
    },
    onError: (err: ApiError) => {
      setConfirmOpen(false);
      if (err.errors[0]?.includes("No payment method")) {
        toast.error("Please add a payment method in Settings before paying.");
      } else {
        toast.error(err.errors[0] ?? "Payment failed. Please try again or update your card.");
      }
    },
  });

  const ratingMutation = useMutation({
    mutationFn: () =>
      apiClient("/api/ratings", {
        method: "POST",
        body: { jobRequestId: jobId, revieweeId: assignedVendorId, score: ratingScore, comment: ratingComment || undefined },
      }),
    onSuccess: () => {
      toast.success("Thanks for rating!");
      setRatingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => {
      toast.error("Rating failed, but payment was successful.");
      setRatingOpen(false);
    },
  });

  const platformFee = Math.round(budgetCents * 0.15);

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={chargeMutation.isPending}
        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {chargeMutation.isPending ? (
          <Spinner className="h-4 w-4 border-white border-t-transparent" />
        ) : (
          <DollarSign className="h-4 w-4" />
        )}
        Verify & Release Payment
      </button>

      {/* Payment confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        title="Verify work and release payment?"
        description={`The escrowed ${formatCents(budgetCents)} will be released to the vendor (minus ${formatCents(platformFee)} platform fee). Vendor receives: ${formatCents(budgetCents - platformFee)}.`}
        confirmLabel={chargeMutation.isPending ? "Processing..." : "Release Payment"}
        isPending={chargeMutation.isPending}
        onConfirm={() => chargeMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Rating modal after successful payment */}
      {ratingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Rate {assignedVendorName ?? "the vendor"}</h3>
            <p className="mt-1 text-sm text-gray-500">How was the work quality?</p>

            {/* Stars */}
            <div className="mt-4 flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRatingScore(s)}
                  onMouseEnter={() => setHoverStar(s)}
                  onMouseLeave={() => setHoverStar(0)}
                  className="p-0.5"
                  aria-label={`${s} star`}
                >
                  <Star className={`h-8 w-8 transition ${s <= (hoverStar || ratingScore) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                </button>
              ))}
            </div>

            {/* Comment */}
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Optional comment..."
              rows={3}
              className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setRatingOpen(false)} className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Skip
              </button>
              <button
                onClick={() => ratingMutation.mutate()}
                disabled={ratingScore === 0 || ratingMutation.isPending}
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {ratingMutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
