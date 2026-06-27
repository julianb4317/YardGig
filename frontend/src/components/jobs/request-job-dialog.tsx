"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { requestJob, checkScheduleConflicts } from "@/lib/api/jobs";
import type { ScheduleConflict } from "@/lib/api/jobs";
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
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      resetAndClose();
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to request job.");
    },
  });

  const resetAndClose = () => {
    setConflicts(null);
    setShowConflictWarning(false);
    setProposedPrice("");
    setNote("");
    onClose();
  };

  const handleSendRequest = async () => {
    // First, check for scheduling conflicts
    setIsCheckingConflicts(true);
    try {
      const result = await checkScheduleConflicts(jobId);
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setShowConflictWarning(true);
      } else {
        // No conflicts, proceed directly
        mutation.mutate();
      }
    } catch {
      // If conflict check fails, allow the request anyway
      mutation.mutate();
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleConfirmDespiteConflicts = () => {
    setShowConflictWarning(false);
    mutation.mutate();
  };

  if (!open) return null;

  // Conflict warning modal
  if (showConflictWarning && conflicts && conflicts.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={resetAndClose}>
        <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Schedule Conflict</h3>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            You have existing jobs that overlap with this job's schedule. You can still request it, but verify you can handle both.
          </p>

          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {conflicts.map((c) => (
              <div key={c.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-gray-800">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.scheduleStart && new Date(c.scheduleStart).toLocaleDateString()}
                  {c.scheduleEnd && ` – ${new Date(c.scheduleEnd).toLocaleDateString()}`}
                  {" · "}{c.status === "InProgress" ? "In Progress" : c.status}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetAndClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go Back
            </button>
            <button
              onClick={handleConfirmDespiteConflicts}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
              Request Anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main request dialog
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={resetAndClose}>
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
            onClick={resetAndClose}
            disabled={mutation.isPending || isCheckingConflicts}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSendRequest}
            disabled={mutation.isPending || isCheckingConflicts}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {(mutation.isPending || isCheckingConflicts) && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}
