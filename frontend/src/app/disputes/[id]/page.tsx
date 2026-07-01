"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorState } from "@/components/ui/error-state";
import { PageLoader } from "@/components/ui/spinner";
import { PhotoGrid } from "@/components/ui/photo-lightbox";
import { DisputeChat } from "@/components/disputes/dispute-chat";
import { apiClient, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DisputeDetail {
  id: string;
  disputeNumber: string;
  jobRequestId: string;
  jobTitle: string;
  summary: string;
  reason: string;
  evidencePhotos: string[] | null;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  raisedByName: string;
}

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-amber-100 text-amber-800",
  Investigating: "bg-blue-100 text-blue-800",
  Resolved: "bg-green-100 text-green-800",
  Dismissed: "bg-gray-100 text-gray-600",
};

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: dispute, isLoading, isError, refetch } = useQuery({
    queryKey: ["dispute", id],
    queryFn: () => apiClient<DisputeDetail>(`/api/disputes/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (isError || !dispute) {
    return (
      <AuthGuard>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <ErrorState title="Dispute not found" message="This dispute may have been removed." onRetry={() => refetch()} />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h1 className="text-2xl font-bold">{dispute.summary}</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Dispute #{dispute.disputeNumber} · Filed {new Date(dispute.createdAt.endsWith("Z") ? dispute.createdAt : dispute.createdAt + "Z").toLocaleDateString()}
            </p>
          </div>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-medium", STATUS_COLORS[dispute.status] ?? "bg-gray-100")}>
            {dispute.status}
          </span>
        </div>

        {/* Job reference */}
        <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Related Job</p>
          <button
            onClick={() => router.push(`/jobs/${dispute.jobRequestId}`)}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {dispute.jobTitle}
          </button>
        </div>

        {/* Description */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Description</h2>
          <p className="mt-2 text-gray-700 whitespace-pre-wrap">{dispute.reason}</p>
        </div>

        {/* Evidence photos */}
        {dispute.evidencePhotos && dispute.evidencePhotos.length > 0 && (
          <PhotoGrid photos={dispute.evidencePhotos} label="Evidence" />
        )}

        {/* Resolution */}
        {dispute.resolution && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <h2 className="text-sm font-semibold text-green-800">Resolution</h2>
            <p className="mt-1 text-sm text-green-700">{dispute.resolution}</p>
            {dispute.resolvedAt && (
              <p className="mt-1 text-xs text-green-600">
                Resolved {new Date(dispute.resolvedAt.endsWith("Z") ? dispute.resolvedAt : dispute.resolvedAt + "Z").toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Close dispute button (only for open disputes) */}
        {(dispute.status === "Open" || dispute.status === "Investigating") && (
          <CloseDisputeButton disputeId={dispute.id} />
        )}

        {/* Chat */}
        <div className="mt-8 border-t pt-6">
          <DisputeChat disputeId={dispute.id} />
        </div>
      </div>
    </AuthGuard>
  );
}

function CloseDisputeButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const closeMut = useMutation({
    mutationFn: () => apiClient<{ success: boolean }>(`/api/disputes/${disputeId}/close`, { method: "PUT" }),
    onSuccess: () => {
      toast.success("Dispute closed. Payment flow resumed.");
      queryClient.invalidateQueries({ queryKey: ["dispute", disputeId] });
      queryClient.invalidateQueries({ queryKey: ["myDisputes"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to close dispute."),
  });

  return (
    <>
      <div className="mt-6">
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close Dispute
        </button>
        <p className="mt-1 text-xs text-gray-400">Closing the dispute resumes the normal payment flow. The vendor will be paid within 48 hours.</p>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmOpen(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Close this dispute?</h3>
            <p className="mt-2 text-sm text-gray-600">
              The job will return to "Completed" status and the normal payment verification flow will resume. You'll have 48 hours to verify, or payment releases automatically.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => { closeMut.mutate(); setConfirmOpen(false); }}
                disabled={closeMut.isPending}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Close Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
