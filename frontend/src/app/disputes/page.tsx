"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DisputeListItem {
  id: string;
  disputeNumber: string;
  jobRequestId: string;
  jobTitle: string;
  summary: string;
  reason: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-amber-100 text-amber-800",
  Investigating: "bg-blue-100 text-blue-800",
  Resolved: "bg-green-100 text-green-800",
  Dismissed: "bg-gray-100 text-gray-600",
};

export default function DisputesListPage() {
  const { data: disputes, isLoading, isError, refetch } = useQuery({
    queryKey: ["myDisputes"],
    queryFn: () => apiClient<DisputeListItem[]>("/api/disputes/mine"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h1 className="text-2xl font-bold">My Disputes</h1>
        </div>

        {isError && <ErrorState message="Failed to load disputes." onRetry={() => refetch()} />}

        {disputes && disputes.length === 0 && (
          <EmptyState
            title="No disputes"
            message="You haven't filed any disputes. If you have an issue with a job, you can file a dispute from the job details page."
          />
        )}

        {disputes && disputes.length > 0 && (
          <div className="space-y-3">
            {disputes.map((dispute) => (
              <div key={dispute.id} className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/disputes/${dispute.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
                      {dispute.summary}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-mono">{dispute.disputeNumber}</span>
                      <span>·</span>
                      <Link href={`/jobs/${dispute.jobRequestId}`} className="text-gray-600 hover:text-brand-600 hover:underline">
                        {dispute.jobTitle}
                      </Link>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Filed {new Date(dispute.createdAt.endsWith("Z") ? dispute.createdAt : dispute.createdAt + "Z").toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[dispute.status] ?? "bg-gray-100")}>
                    {dispute.status}
                  </span>
                </div>
                {dispute.resolution && (
                  <p className="mt-2 text-xs text-green-700 bg-green-50 rounded p-2">Resolution: {dispute.resolution}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
