"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";
import { initiatePayment, capturePayment } from "@/lib/api/payments";
import { ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCents } from "@/lib/utils";

interface PaymentButtonProps {
  jobId: string;
  budgetCents: number;
}

/**
 * Two-step payment flow:
 * 1. POST /api/payments/initiate → gets clientSecret + fee breakdown
 * 2. (Future: Stripe.js confirmCardPayment with clientSecret)
 * 3. POST /api/payments/capture → finalizes payment
 * 
 * For MVP without Stripe Elements, steps 1+3 are called in sequence.
 * When Stripe.js is integrated, step 2 will show the card form between 1 and 3.
 */
export function PaymentButton({ jobId, budgetCents }: PaymentButtonProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feeInfo, setFeeInfo] = useState<{ platformFeeCents: number; vendorNetCents: number } | null>(null);

  const initMutation = useMutation({
    mutationFn: () => initiatePayment(jobId),
    onSuccess: (data) => {
      setFeeInfo({ platformFeeCents: data.platformFeeCents, vendorNetCents: data.vendorNetCents });
      // In production: use data.clientSecret with Stripe Elements here
      // For now: proceed to capture directly
      captureMutation.mutate();
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to initiate payment.");
      setConfirmOpen(false);
    },
  });

  const captureMutation = useMutation({
    mutationFn: () => capturePayment(jobId),
    onSuccess: () => {
      toast.success("Payment processed! Vendor will receive payout within 2 business days.");
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Payment capture failed.");
      setConfirmOpen(false);
    },
  });

  const isPending = initMutation.isPending || captureMutation.isPending;
  const platformFee = Math.round(budgetCents * 0.15);

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {isPending ? (
          <Spinner className="h-4 w-4 border-white border-t-transparent" />
        ) : (
          <DollarSign className="h-4 w-4" />
        )}
        Confirm & Pay {formatCents(budgetCents)}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Payment"
        description={`Total: ${formatCents(budgetCents)}. Platform fee: ${formatCents(feeInfo?.platformFeeCents ?? platformFee)}. Vendor receives: ${formatCents(feeInfo?.vendorNetCents ?? (budgetCents - platformFee))}.`}
        confirmLabel={isPending ? "Processing..." : `Pay ${formatCents(budgetCents)}`}
        isPending={isPending}
        onConfirm={() => initMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
