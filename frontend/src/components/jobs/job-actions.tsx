"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Play, CheckCircle, XCircle } from "lucide-react";
import { updateJobStatus, cancelJob } from "@/lib/api/jobs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import type { JobDetail } from "@/lib/types";
import { hasRole } from "@/lib/auth";

interface JobActionsProps {
  job: JobDetail;
}

export function JobActions({ job }: JobActionsProps) {
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["job", job.id] });
    queryClient.invalidateQueries({ queryKey: ["myJobs"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateJobStatus(job.id, status),
    onSuccess: () => {
      toast.success("Status updated.");
      invalidate();
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(job.id, cancelReason || undefined),
    onSuccess: (data) => {
      setCancelOpen(false);
      toast.success(data.penaltyApplied ? "Cancelled (late-cancel fee applied)." : "Job cancelled.");
      invalidate();
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0]);
    },
  });

  const isVendor = hasRole("Vendor");
  const isCustomer = hasRole("Customer");

  return (
    <div className="flex flex-wrap gap-3">
      {/* Vendor: Start work */}
      {isVendor && job.status === "Assigned" && (
        <button
          onClick={() => statusMutation.mutate("InProgress")}
          disabled={statusMutation.isPending}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {statusMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Play className="h-4 w-4" />}
          Start Work
        </button>
      )}

      {/* Vendor: Mark completed */}
      {isVendor && job.status === "InProgress" && (
        <button
          onClick={() => statusMutation.mutate("Completed")}
          disabled={statusMutation.isPending}
          className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {statusMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <CheckCircle className="h-4 w-4" />}
          Mark Completed
        </button>
      )}

      {/* Customer: Cancel (when allowed) */}
      {isCustomer && ["Open", "Requested", "Assigned"].includes(job.status) && (
        <>
          <button
            onClick={() => setCancelOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" /> Cancel Job
          </button>

          <ConfirmDialog
            open={cancelOpen}
            title="Cancel this job?"
            description="Pending vendor requests will be rejected. If a vendor is assigned and the job starts within 2 hours, a late-cancellation fee may apply."
            confirmLabel="Yes, Cancel"
            variant="danger"
            isPending={cancelMutation.isPending}
            onConfirm={() => cancelMutation.mutate()}
            onCancel={() => setCancelOpen(false)}
          />
        </>
      )}
    </div>
  );
}
