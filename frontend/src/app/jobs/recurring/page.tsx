"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { RefreshCw, Pause, Play, XCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchMySeries, pauseSeries, resumeSeries, cancelSeries } from "@/lib/api/recurring-jobs";
import { formatCents, cn } from "@/lib/utils";
import type { RecurringSeries } from "@/lib/api/recurring-jobs";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-800",
  Paused: "bg-yellow-100 text-yellow-800",
  PaymentRequired: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

function formatFrequency(frequency: string, days: string[], time: string): string {
  const freq = frequency === "biweekly" ? "Every 2 weeks" : frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const dayStr = days.map(d => d.slice(0, 3)).join(", ");
  return `${freq} · ${dayStr} · ${time}`;
}

function SeriesCard({ series }: { series: RecurringSeries }) {
  const queryClient = useQueryClient();

  const pauseMut = useMutation({
    mutationFn: () => pauseSeries(series.id),
    onSuccess: () => { toast.success("Series paused."); queryClient.invalidateQueries({ queryKey: ["mySeries"] }); },
    onError: () => toast.error("Failed to pause series."),
  });

  const resumeMut = useMutation({
    mutationFn: () => resumeSeries(series.id),
    onSuccess: () => { toast.success("Series resumed!"); queryClient.invalidateQueries({ queryKey: ["mySeries"] }); },
    onError: () => toast.error("Failed to resume. Check your payment method."),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelSeries(series.id),
    onSuccess: () => { toast.success("Series cancelled."); queryClient.invalidateQueries({ queryKey: ["mySeries"] }); },
    onError: () => toast.error("Failed to cancel series."),
  });

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/jobs/recurring/${series.id}`} className="font-medium text-gray-900 hover:text-brand-600">
            {series.templateTitle}
          </Link>
          <p className="mt-1 text-sm text-gray-500">
            {formatFrequency(series.frequency, series.days, series.time)}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[series.status] ?? "bg-gray-100")}>
          {series.status === "PaymentRequired" ? "Payment Required" : series.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
        <span className="font-semibold text-gray-900">{formatCents(series.budgetCents)}/occurrence</span>
        {series.nextOccurrence && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Next: {new Date(series.nextOccurrence).toLocaleDateString()}
          </span>
        )}
        <span>{series.totalOccurrences} completed</span>
        {series.assignedVendorName && (
          <span className="text-purple-700 font-medium">{series.assignedVendorName}</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {series.status === "Active" && (
          <button
            onClick={() => pauseMut.mutate()}
            disabled={pauseMut.isPending}
            className="flex items-center gap-1 rounded-md border border-yellow-300 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-50"
          >
            <Pause className="h-3.5 w-3.5" /> Pause
          </button>
        )}
        {(series.status === "Paused" || series.status === "PaymentRequired") && (
          <button
            onClick={() => resumeMut.mutate()}
            disabled={resumeMut.isPending}
            className="flex items-center gap-1 rounded-md border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
          >
            <Play className="h-3.5 w-3.5" /> Resume
          </button>
        )}
        {series.status !== "Cancelled" && (
          <button
            onClick={() => { if (confirm("Cancel this recurring series? This cannot be undone.")) cancelMut.mutate(); }}
            disabled={cancelMut.isPending}
            className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancel Series
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecurringJobsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mySeries"],
    queryFn: fetchMySeries,
  });

  if (isLoading) return <PageLoader />;

  return (
    <AuthGuard requiredRole="Customer">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-brand-600" />
            <h1 className="text-2xl font-bold">Recurring Jobs</h1>
          </div>
          <Link
            href="/jobs/create"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New Job
          </Link>
        </div>

        {isError && <ErrorState message="Failed to load recurring jobs." onRetry={() => refetch()} />}

        {data && data.length === 0 && (
          <EmptyState
            title="No recurring jobs"
            message="Set up a recurring schedule when posting a job to have it repeat automatically."
          />
        )}

        {data && data.length > 0 && (
          <div className="space-y-3">
            {data.map((series) => (
              <SeriesCard key={series.id} series={series} />
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
