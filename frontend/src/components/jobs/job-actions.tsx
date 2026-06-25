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

interface JobActionsProps {
  job: JobDetail;
}

export function JobActions({ job }: JobActionsProps) {
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionPhotos, setCompletionPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      setCompleteOpen(false);
      setCompletionPhotos([]);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setCompletionPhotos((prev) => [...prev, ...files].slice(0, 5)); // Max 5 photos
  };

  const removePhoto = (index: number) => {
    setCompletionPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (completionPhotos.length === 0) {
      toast.error("Please upload at least one completion photo.");
      return;
    }
    // TODO: In production, upload photos to S3 first, then pass URLs to the status update
    // For now, proceed with marking complete (photos stored locally for demo)
    statusMutation.mutate("Completed");
  };

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

          {/* Completion dialog with photo upload */}
          {completeOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCompleteOpen(false)}>
              <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold">Mark Job as Completed</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Upload photos of the completed work so the customer can verify remotely.
                </p>

                {/* Photo upload area */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Photos <span className="text-red-500">*</span>
                  </label>

                  {/* Photo previews */}
                  {completionPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {completionPhotos.map((file, i) => (
                        <div key={i} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Completion photo ${i + 1}`}
                            className="h-20 w-full rounded-md object-cover"
                          />
                          <button
                            onClick={() => removePhoto(i)}
                            className="absolute -top-1 -right-1 rounded-full bg-red-500 p-0.5 text-white text-xs"
                            aria-label="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {completionPhotos.length < 5 && (
                    <div className="flex gap-2">
                      {/* Browse files */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4" /> Browse Files
                      </button>
                      {/* Camera capture */}
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Camera className="h-4 w-4" /> Take Photo
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <p className="mt-2 text-xs text-gray-400">
                    {completionPhotos.length}/5 photos added. At least 1 required.
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => { setCompleteOpen(false); setCompletionPhotos([]); }}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={statusMutation.isPending || completionPhotos.length === 0}
                    className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {statusMutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
                    Submit & Mark Complete
                  </button>
                </div>
              </div>
            </div>
          )}
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
                The vendor has marked this job as done. Review the work and completion photos, then release payment below.
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
