"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DollarSign, Star, Clock } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { chargeHourlyJob } from "@/lib/api/jobs";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCents } from "@/lib/utils";

interface PaymentButtonProps {
  jobId: string;
  budgetCents: number;
  assignedVendorId?: string;
  assignedVendorName?: string;
  pricingType?: string;
  hourlyRateCents?: number | null;
  estimatedHours?: number | null;
  maxHours?: number | null;
  assignmentStartedAt?: string | null;
  assignmentCompletedAt?: string | null;
}

export function PaymentButton({
  jobId,
  budgetCents,
  assignedVendorId,
  assignedVendorName,
  pricingType,
  hourlyRateCents,
  estimatedHours,
  maxHours,
  assignmentStartedAt,
  assignmentCompletedAt,
}: PaymentButtonProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hourlyModalOpen, setHourlyModalOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [resolvedVendorId, setResolvedVendorId] = useState<string | undefined>(assignedVendorId);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [hoverStar, setHoverStar] = useState(0);

  // Hourly job state
  const isHourly = pricingType === "hourly";
  const elapsedHours = assignmentStartedAt && assignmentCompletedAt
    ? Math.round(((new Date(assignmentCompletedAt).getTime() - new Date(assignmentStartedAt).getTime()) / 3600000) * 100) / 100
    : estimatedHours ?? 1;
  const cappedElapsed = maxHours ? Math.min(elapsedHours, maxHours) : elapsedHours;
  const [approvedHours, setApprovedHours] = useState<number>(cappedElapsed);

  const chargeMutation = useMutation({
    mutationFn: () =>
      apiClient<{ transactionId?: string; vendorUserId?: string; message?: string; alreadyPaid?: boolean }>("/api/payments/charge", {
        method: "POST",
        body: { jobRequestId: jobId },
      }),
    onSuccess: (data) => {
      toast.success("Payment processed! Vendor will receive their payout.");
      setConfirmOpen(false);
      const vendorId = data.vendorUserId ?? assignedVendorId;
      if (vendorId) {
        setResolvedVendorId(vendorId);
        setRatingOpen(true);
      } else {
        queryClient.invalidateQueries({ queryKey: ["job", jobId] });
        queryClient.invalidateQueries({ queryKey: ["myJobs"] });
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

  const hourlyChargeMutation = useMutation({
    mutationFn: () => chargeHourlyJob(jobId, approvedHours),
    onSuccess: (data) => {
      toast.success("Payment processed! Vendor will receive their payout.");
      setHourlyModalOpen(false);
      const vendorId = data.vendorUserId ?? assignedVendorId;
      if (vendorId) {
        setResolvedVendorId(vendorId);
        setRatingOpen(true);
      } else {
        queryClient.invalidateQueries({ queryKey: ["job", jobId] });
        queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      }
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Payment failed. Please try again.");
    },
  });

  const ratingMutation = useMutation({
    mutationFn: () =>
      apiClient("/api/ratings", {
        method: "POST",
        body: { jobRequestId: jobId, revieweeId: resolvedVendorId, score: ratingScore, comment: ratingComment || undefined },
      }),
    onSuccess: () => {
      toast.success("Thanks for rating!");
      setRatingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
    },
    onError: () => {
      toast.error("Rating failed, but payment was successful.");
      setRatingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
    },
  });

  const handleClick = () => {
    if (isHourly) {
      setApprovedHours(cappedElapsed);
      setHourlyModalOpen(true);
    } else {
      setConfirmOpen(true);
    }
  };

  const hourlyChargeCents = Math.round(approvedHours * (hourlyRateCents ?? 0));

  return (
    <>
      <button
        onClick={handleClick}
        disabled={chargeMutation.isPending || hourlyChargeMutation.isPending}
        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {(chargeMutation.isPending || hourlyChargeMutation.isPending) ? (
          <Spinner className="h-4 w-4 border-white border-t-transparent" />
        ) : isHourly ? (
          <Clock className="h-4 w-4" />
        ) : (
          <DollarSign className="h-4 w-4" />
        )}
        {isHourly ? "Review Hours & Pay" : "Verify & Release Payment"}
      </button>

      {/* Fixed-price payment confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        title="Verify work and release payment?"
        description={`The vendor will receive the full ${formatCents(budgetCents)} for this job. Your card was charged when the vendor was assigned (including service fees). Confirming releases the funds to the vendor's balance.`}
        confirmLabel={chargeMutation.isPending ? "Processing..." : "Release Payment"}
        isPending={chargeMutation.isPending}
        onConfirm={() => chargeMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Hourly payment modal */}
      {hourlyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Review Hourly Charges</h3>
            <p className="mt-1 text-sm text-gray-500">Confirm the hours worked and approve the payment.</p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Hourly Rate</span>
                <span className="font-medium">{formatCents(hourlyRateCents ?? 0)}/hr</span>
              </div>

              {assignmentStartedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Started</span>
                  <span className="font-medium">{new Date(assignmentStartedAt).toLocaleString()}</span>
                </div>
              )}
              {assignmentCompletedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-medium">{new Date(assignmentCompletedAt).toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Calculated Elapsed</span>
                <span className="font-medium">{elapsedHours.toFixed(2)}h{maxHours && elapsedHours > maxHours ? ` (capped at ${maxHours}h)` : ""}</span>
              </div>

              <div className="border-t pt-3">
                <label className="block text-sm font-medium text-gray-700">Approved Hours</label>
                <input
                  type="number"
                  min={0.5}
                  max={maxHours ?? 100}
                  step={0.25}
                  value={approvedHours}
                  onChange={(e) => setApprovedHours(Math.min(parseFloat(e.target.value) || 0, maxHours ?? 100))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-gray-400">You can adjust down if needed. Max: {maxHours}h</p>
              </div>

              <div className="border-t pt-3 flex justify-between font-semibold text-base">
                <span>Vendor Payment</span>
                <span>{formatCents(hourlyChargeCents)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setHourlyModalOpen(false)}
                className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => hourlyChargeMutation.mutate()}
                disabled={hourlyChargeMutation.isPending || approvedHours <= 0}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {hourlyChargeMutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
                Approve & Pay {formatCents(hourlyChargeCents)}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => { setRatingOpen(false); queryClient.invalidateQueries({ queryKey: ["job", jobId] }); queryClient.invalidateQueries({ queryKey: ["myJobs"] }); }} className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
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
