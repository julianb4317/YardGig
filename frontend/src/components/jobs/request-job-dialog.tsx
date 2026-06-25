"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requestJob } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";

interface RequestJobDialogProps {
  jobId: string;
  jobTitle: string;
  open: boolean;
  onClose: () => void;
}

export function RequestJobDialog({ jobId, jobTitle, open, onClose }: RequestJobDialogProps) {
  const [proposedPrice, setProposedPrice] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      requestJob(jobId, {
        proposedPriceCents: proposedPrice ? Math.round(Number(proposedPrice) * 100) : undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      toast.success("Job requested! The customer will review your request.");
      queryClient.invalidateQueries({ queryKey: ["vendorJobs"] });
      onClose();
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to request job.");
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Request Job</h3>
        <p className="mt-1 text-sm text-gray-500 line-clamp-1">"{jobTitle}"</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Your Price (optional)</label>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
              <input
                type="number"
                value={proposedPrice}
                onChange={(e) => setProposedPrice(e.target.value)}
                placeholder="Leave blank to accept posted budget"
                min={1}
                className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Note to Customer (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Introduce yourself, mention availability, etc."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">{note.length}/500</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}
