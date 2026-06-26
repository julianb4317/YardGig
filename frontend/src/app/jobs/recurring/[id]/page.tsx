"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Calendar, Pause, Play, XCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { fetchSeriesDetail, pauseSeries, resumeSeries, cancelSeries, withdrawFromSeries } from "@/lib/api/recurring-jobs";
import { formatCents, cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/types";
import { hasRole } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-800",
  Paused: "bg-yellow-100 text-yellow-800",
  PaymentRequired: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  Open: "text-green-600",
  Assigned: "text-purple-600",
  InProgress: "text-yellow-600",
  Completed: "text-teal-600",
  Paid: "text-emerald-600",
};

export default function RecurringSeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: series, isLoading, isError, refetch } = useQuery({
    queryKey: ["seriesDetail", id],
    queryFn: () => fetchSeriesDetail(id),
    enabled: !!id,
  });

  const pauseMut = useMutation({
    mutationFn: () => pauseSeries(id),
    onSuccess: () => { toast.success("Series paused."); queryClient.invalidateQueries({ queryKey: ["seriesDetail", id] }); },
    onError: () => toast.error("Failed to pause."),
  });

  const resumeMut = useMutation({
    mutationFn: () => resumeSeries(id),
    onSuccess: () => { toast.success("Series resumed!"); queryClient.invalidateQueries({ queryKey: ["seriesDetail", id] }); },
    onError: () => toast.error("Failed to resume. Check your payment method."),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelSeries(id),
    onSuccess: () => { toast.success("Series cancelled."); queryClient.invalidateQueries({ queryKey: ["seriesDetail", id] }); },
    onError: () => toast.error("Failed to cancel."),
  });

  const withdrawMut = useMutation({
    mutationFn: () => withdrawFromSeries(id),
    onSuccess: () => { toast.success("Withdrawn from recurring series."); queryClient.invalidateQueries({ queryKey: ["seriesDetail", id] }); },
    onError: () => toast.error("Failed to withdraw."),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !series) {
    return (
      <AuthGuard>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <ErrorState title="Series not found" message="This recurring series may have been removed." onRetry={() => refetch()} />
        </div>
      </AuthGuard>
    );
  }

  const isCustomer = hasRole("Customer");
  const isVendor = hasRole("Vendor");

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-brand-600" />
            <h1 className="text-2xl font-bold">{series.templateTitle}</h1>
          </div>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-medium", STATUS_COLORS[series.status] ?? "bg-gray-100")}>
            {series.status === "PaymentRequired" ? "Payment Required" : series.status}
          </span>
        </div>

        {/* Schedule info */}
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase">Frequency</p>
              <p className="text-sm font-medium text-brand-800 capitalize">{series.frequency}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase">Days</p>
              <p className="text-sm font-medium text-brand-800">{series.days.join(", ")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase">Time</p>
              <p className="text-sm font-medium text-brand-800">{series.time}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase">Budget per occurrence</p>
              <p className="text-sm font-medium text-brand-800">{formatCents(series.budgetCents)}</p>
            </div>
            {series.nextOccurrence && (
              <div>
                <p className="text-xs font-semibold text-brand-600 uppercase">Next occurrence</p>
                <p className="text-sm font-medium text-brand-800">
                  {new Date(series.nextOccurrence).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </p>
              </div>
            )}
            {series.assignedVendorName && (
              <div>
                <p className="text-xs font-semibold text-brand-600 uppercase">Assigned vendor</p>
                <p className="text-sm font-medium text-brand-800">{series.assignedVendorName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Categories */}
        {series.categories && series.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {series.categories.map((cat) => (
              <span key={cat} className="rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-700">
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
            ))}
          </div>
        )}

        {/* Payment Required warning */}
        {series.status === "PaymentRequired" && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">⚠️ Payment method needs updating</p>
            <p className="mt-1 text-xs text-red-600">
              Your card on file has expired or is missing. Update your payment method in Settings, then resume this series.
            </p>
            <Link href="/settings" className="mt-2 inline-block text-xs font-medium text-red-700 underline">
              Go to Settings
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {isCustomer && series.status === "Active" && (
            <button
              onClick={() => pauseMut.mutate()}
              disabled={pauseMut.isPending}
              className="flex items-center gap-1.5 rounded-md border border-yellow-300 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-50"
            >
              <Pause className="h-4 w-4" /> Pause Series
            </button>
          )}
          {isCustomer && (series.status === "Paused" || series.status === "PaymentRequired") && (
            <button
              onClick={() => resumeMut.mutate()}
              disabled={resumeMut.isPending}
              className="flex items-center gap-1.5 rounded-md border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
            >
              <Play className="h-4 w-4" /> Resume Series
            </button>
          )}
          {isCustomer && series.status !== "Cancelled" && (
            <button
              onClick={() => { if (confirm("Cancel this recurring series permanently?")) cancelMut.mutate(); }}
              disabled={cancelMut.isPending}
              className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" /> Cancel Series
            </button>
          )}
          {isVendor && series.status === "Active" && (
            <button
              onClick={() => { if (confirm("Withdraw from this recurring job? The customer will need to find a new vendor.")) withdrawMut.mutate(); }}
              disabled={withdrawMut.isPending}
              className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" /> Withdraw from Series
            </button>
          )}
        </div>

        {/* Past occurrences */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Past Occurrences ({series.totalOccurrences})</h2>
          {series.occurrences.length === 0 ? (
            <p className="text-sm text-gray-500">No occurrences yet. The first will be created on the next scheduled date.</p>
          ) : (
            <div className="space-y-2">
              {series.occurrences.map((occ) => (
                <Link
                  key={occ.id}
                  href={`/jobs/${occ.id}`}
                  className="flex items-center justify-between rounded-md border border-gray-100 p-3 hover:border-brand-200 transition"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className={cn("h-4 w-4", JOB_STATUS_COLORS[occ.status] ?? "text-gray-400")} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {occ.scheduleStart ? new Date(occ.scheduleStart).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—"}
                      </p>
                      <p className="text-xs text-gray-500">{occ.status === "InProgress" ? "In Progress" : occ.status}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{formatCents(occ.budgetCents)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
