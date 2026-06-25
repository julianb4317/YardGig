"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Play, CheckCircle, XCircle, Eye } from "lucide-react";
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
  const [completeOpen, setCompleteOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["job", job.id] });
    queryClient.invalidateQueries({ queryKey: ["myJobs"] });
    queryClient.invalidateQueries({ queryKey: ["vendorJobs"] });
    queryClient.invalidateQueries({ queryKey: ["vendorMyRequests"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateJobStatus(job.id, status),
    onSuccess: (_, status) => {
      toast.success(`Job status updated to ${status}.`);
      invalidate();
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to update status."),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(job.id),
    onSuccess: (data) => {
      setCancelOpen(false);
      toast.success(data.penaltyApplied ? "Cancelled (late-cancel fee applied)." : "Job cancelled.");
      invalidate();
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to cancel."),
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
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {statusMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Play className="h-4 w-4" />}
          Start Work
        </button>
      )}

      {/* Vendor: Mark completed */}
      {isVendor && job.status === "InProgress" && (
        <>
          <button
            onClick={() => setCompleteOpen(true)}
            disabled={statusMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {statusMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <CheckCircle className="h-4 w-4" />}
            Mark Completed
          </button>

          <ConfirmDialog
            open={completeOpen}
            title="Mark job as completed?"
            description="The customer will be notified and asked to verify the work and release payment. Please upload completion photos so the customer can review remotely."
            confirmLabel="Yes, Mark Complete"
            isPending={statusMutation.isPending}
            onConfirm={() => {
              statusMutation.mutate("Completed");
              setCompleteOpen(false);
            }}
            onCancel={() => setCompleteOpen(false)}
          />
        </>
      )}

      {/* Customer: Verify & Close (after vendor marks complete) */}
      {isCustomer && job.status === "Completed" && (
        <div className="w-full rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">Work completed — verify and pay</p>
              <p className="mt-1 text-xs text-green-600">
                The vendor has marked this job as done. Review the work (check photos if available) and click below to release payment.
              </p>
            </div>
          </div>
        </div>
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

      {/* Status badges for informational states */}
      {job.status === "Paid" && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
          ✅ Payment complete
        </div>
      )}
      {job.status === "Closed" && (
        <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-2 text-sm text-gray-600">
          Job closed
        </div>
      )}
    </div>
  );
}
