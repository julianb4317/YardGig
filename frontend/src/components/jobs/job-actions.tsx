"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Play, CheckCircle, XCircle, Eye, Camera, Upload } from "lucide-react";
import { updateJobStatus, cancelJob } from "@/lib/api/jobs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import type { JobDetail } from "@/lib/types";
import { hasRole } from "@/lib/auth";

export function formatStatus(status: string): string {
  if (status === "InProgress") return "In Progress";
  return status;
}

interface JobActionsProps {
  job: JobDetail;
}

export function JobActions({ job }: JobActionsProps) {
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const effectiveStatus = localStatus ?? job.status;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["job", job.id] });
    queryClient.invalidateQueries({ queryKey: ["myJobs"] });
    queryClient.invalidateQueries({ queryKey: ["vendorJobs"] });
    queryClient.invalidateQueries({ queryKey: ["vendorMyRequests"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateJobStatus(job.id, status),
    onSuccess: (_, status) => {
      setLocalStatus(status);
      setCompleteOpen(false);
      setPhotos([]);
      toast.success(`Status updated to ${formatStatus(status)}.`);
      invalidate();
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to update status."),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(job.id),
    onSuccess: (data) => {
      setCancelOpen(false);
      setLocalStatus("Cancelled");
      toast.success(data.penaltyApplied ? "Cancelled (late-cancel fee applied)." : "Job cancelled.");
      invalidate();
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to cancel."),
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos((p) => [...p, ...files].slice(0, 5));
    e.target.value = "";
  };

  const submitComplete = () => {
    if (photos.length === 0) {
      toast.error("Upload at least one completion photo.");
      return;
    }
    statusMutation.mutate("Completed");
  };

  const isVendor = hasRole("Vendor");
  const isCustomer = hasRole("Customer");

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {isVendor && effectiveStatus === "Assigned" && (
          <button
            onClick={() => statusMutation.mutate("InProgress")}
            disabled={statusMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {statusMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Play className="h-4 w-4" />}
            Start Work
          </button>
        )}

        {isVendor && effectiveStatus === "InProgress" && (
          <button
            onClick={() => setCompleteOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            <CheckCircle className="h-4 w-4" />
            Mark Completed
          </button>
        )}

        {isCustomer && effectiveStatus === "Completed" && (
          <div className="w-full rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Work completed — verify and pay</p>
                <p className="mt-1 text-xs text-green-600">Review the vendor's completion photos, then release payment.</p>
              </div>
            </div>
          </div>
        )}

        {isCustomer && ["Open", "Requested", "Assigned"].includes(effectiveStatus) && (
          <button onClick={() => setCancelOpen(true)} className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
            <XCircle className="h-4 w-4" /> Cancel Job
          </button>
        )}

        {effectiveStatus === "Paid" && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">✅ Payment complete</div>
        )}
      </div>

      {/* COMPLETION MODAL */}
      {completeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Submit Completed Work</h3>
            <p className="mt-1 text-sm text-gray-500">Upload photos so the customer can verify the work remotely.</p>

            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Completion Photos <span className="text-red-500">*</span></p>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {photos.map((f, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(f)} alt="" className="h-20 w-full rounded object-cover" />
                      <button onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length < 5 && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                    <Upload className="h-4 w-4" /> Browse
                  </button>
                  <button type="button" onClick={() => camRef.current?.click()} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                    <Camera className="h-4 w-4" /> Camera
                  </button>
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
              <p className="mt-2 text-xs text-gray-400">{photos.length}/5 — at least 1 required</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setCompleteOpen(false); setPhotos([]); }} className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={submitComplete} disabled={statusMutation.isPending || photos.length === 0} className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                {statusMutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
                Submit & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this job?"
        description="Pending vendor requests will be rejected. Late-cancel fee may apply if vendor is assigned."
        confirmLabel="Yes, Cancel"
        variant="danger"
        isPending={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  );
}
