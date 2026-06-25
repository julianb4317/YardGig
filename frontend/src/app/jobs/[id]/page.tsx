"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Calendar, MapPin, Tag, DollarSign, Clock } from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorState } from "@/components/ui/error-state";
import { PageLoader } from "@/components/ui/spinner";
import { JobActions } from "@/components/jobs/job-actions";
import { PaymentButton } from "@/components/payments/payment-button";
import { RequestJobDialog } from "@/components/jobs/request-job-dialog";
import { fetchJobDetail } from "@/lib/api/jobs";
import { formatCents, cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/types";
import { hasRole } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-green-100 text-green-800",
  Requested: "bg-blue-100 text-blue-800",
  Assigned: "bg-purple-100 text-purple-800",
  InProgress: "bg-yellow-100 text-yellow-800",
  Completed: "bg-teal-100 text-teal-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Closed: "bg-gray-100 text-gray-600",
  Cancelled: "bg-red-100 text-red-700",
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: job, isLoading, isError, refetch } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJobDetail(id),
    enabled: !!id,
    refetchInterval: 10_000, // Auto-refresh to pick up status changes
  });

  if (isLoading) return <PageLoader />;
  if (isError || !job) {
    return (
      <AuthGuard>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <ErrorState title="Job not found" message="This job may have been removed." onRetry={() => refetch()} />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back link */}
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-medium", STATUS_COLORS[job.status] ?? "bg-gray-100")}>
            {job.status === "InProgress" ? "In Progress" : job.status}
          </span>
        </div>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5 font-semibold text-gray-900 text-base">
            <DollarSign className="h-4 w-4 text-brand-600" />
            {formatCents(job.budgetCents)}
          </span>

          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {job.address}
          </span>

          {job.scheduleStart && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(job.scheduleStart).toLocaleDateString()}
              {job.scheduleEnd && ` – ${new Date(job.scheduleEnd).toLocaleDateString()}`}
            </span>
          )}

          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Posted {new Date(job.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Categories */}
        <div className="mt-4 flex flex-wrap gap-2">
          {job.categories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-700">
              <Tag className="h-3.5 w-3.5" />
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
          ))}
        </div>

        {/* Description */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Description</h2>
          <p className="mt-2 text-gray-700 whitespace-pre-wrap">{job.description}</p>
        </div>

        {/* Photos */}
        {job.photos && job.photos.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {job.status === "Completed" || job.status === "Paid" || job.status === "Closed" ? "Completion Photos" : "Photos"}
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {job.photos.map((url, i) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`} className="rounded-lg object-cover h-32 w-full" />
              ))}
            </div>
          </div>
        )}

        {/* Job Actions */}
        <div className="mt-8 border-t pt-6 space-y-4">
          <JobActions job={job} />

          {/* Customer: payment button when completed */}
          {hasRole("Customer") && job.status === "Completed" && (
            <PaymentButton jobId={job.id} budgetCents={job.budgetCents} assignedVendorId={job.assignedVendorUserId ?? undefined} assignedVendorName={job.assignedVendorName ?? undefined} />
          )}

          {/* Customer: view vendor requests */}
          {hasRole("Customer") && (job.status === "Requested" || job.status === "Open") && (
            <Link
              href={`/jobs/${job.id}/requests`}
              className="inline-block rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              View Vendor Requests
            </Link>
          )}

          {/* Vendor: request this job */}
          {hasRole("Vendor") && (job.status === "Open" || job.status === "Requested") && (
            <VendorRequestSection jobId={job.id} jobTitle={job.title} />
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function VendorRequestSection({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="w-full sm:w-auto rounded-md bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
      >
        🙋 Request This Job
      </button>
      <RequestJobDialog
        jobId={jobId}
        jobTitle={jobTitle}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
