"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiClient, ApiError } from "@/lib/api-client";
import { formatCents, cn } from "@/lib/utils";

interface VendorMyRequest {
  vendorRequestId: string;
  jobId: string;
  jobTitle: string;
  budgetCents: number;
  status: string; // Pending, Accepted, Rejected, Withdrawn
  jobStatus: string; // Open, Assigned, InProgress, Completed, Paid, etc.
  proposedPriceCents: number | null;
  createdAt: string;
}

/**
 * NOTE: Uses GET /api/jobs/vendor/my-requests (see Backend Gaps).
 * If endpoint not yet available, this page will show an error state.
 */
function fetchMyVendorRequests() {
  return apiClient<VendorMyRequest[]>("/api/jobs/vendor/my-requests");
}

function withdrawRequest(jobId: string) {
  return apiClient<{ message: string }>(`/api/jobs/${jobId}/requests/mine`, { method: "DELETE" });
}

const STATUS_STYLES: Record<string, { icon: typeof Clock; color: string }> = {
  Pending: { icon: Clock, color: "text-yellow-600 bg-yellow-50" },
  Accepted: { icon: CheckCircle, color: "text-green-600 bg-green-50" },
  Rejected: { icon: XCircle, color: "text-red-600 bg-red-50" },
  Withdrawn: { icon: XCircle, color: "text-gray-500 bg-gray-50" },
};

export default function VendorMyRequestsPage() {
  const queryClient = useQueryClient();
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendorMyRequests"],
    queryFn: fetchMyVendorRequests,
    refetchInterval: 15_000, // Auto-refresh to pick up status changes
  });

  const withdrawMutation = useMutation({
    mutationFn: (jobId: string) => withdrawRequest(jobId),
    onSuccess: () => {
      toast.success("Request withdrawn.");
      setWithdrawTarget(null);
      queryClient.invalidateQueries({ queryKey: ["vendorMyRequests"] });
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to withdraw.");
      setWithdrawTarget(null);
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <AuthGuard requiredRole="Vendor">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">My Requests</h1>
        <p className="mt-1 text-sm text-gray-500">Jobs you've requested — track status and withdraw if needed.</p>

        {isError && <ErrorState message="Failed to load your requests." onRetry={() => refetch()} />}

        {data && data.length === 0 && (
          <EmptyState
            title="No requests yet"
            message="Browse available jobs and send your first request."
            action={
              <Link href="/dashboard/vendor" className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
                Browse Jobs
              </Link>
            }
          />
        )}

        {data && data.length > 0 && (
          <div className="mt-6 space-y-3">
            {data.map((req) => {
              const { icon: Icon, color } = STATUS_STYLES[req.status] ?? STATUS_STYLES.Pending;
              return (
                <div key={req.vendorRequestId} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/jobs/${req.jobId}`} className="font-medium text-gray-900 hover:text-brand-600 flex items-center gap-1">
                        {req.jobTitle} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <p className="mt-0.5 text-sm text-gray-500">
                        Budget: {formatCents(req.budgetCents)}
                        {req.proposedPriceCents && ` · Your price: ${formatCents(req.proposedPriceCents)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
                        <Icon className="h-3.5 w-3.5" /> {req.status}
                      </span>
                      {req.status === "Accepted" && req.jobStatus && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          Job: {req.jobStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Requested {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                    {req.status === "Pending" && (
                      <button
                        onClick={() => setWithdrawTarget(req.jobId)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ConfirmDialog
          open={!!withdrawTarget}
          title="Withdraw request?"
          description="You won't be able to re-request this job. The customer will be notified."
          confirmLabel="Yes, Withdraw"
          variant="danger"
          isPending={withdrawMutation.isPending}
          onConfirm={() => withdrawTarget && withdrawMutation.mutate(withdrawTarget)}
          onCancel={() => setWithdrawTarget(null)}
        />
      </div>
    </AuthGuard>
  );
}
