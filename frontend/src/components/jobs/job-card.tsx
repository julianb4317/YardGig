"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Tag, RefreshCw } from "lucide-react";
import { formatCents, cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/types";
import type { JobDetail } from "@/lib/types";

function displayStatus(status: string): string {
  if (status === "InProgress") return "In Progress";
  return status;
}

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-green-100 text-green-800",
  Requested: "bg-blue-100 text-blue-800",
  Assigned: "bg-purple-100 text-purple-800",
  InProgress: "bg-yellow-100 text-yellow-800",
  Completed: "bg-teal-100 text-teal-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Closed: "bg-gray-100 text-gray-600",
  Cancelled: "bg-red-100 text-red-700",
  Disputed: "bg-orange-100 text-orange-800",
  Expired: "bg-amber-100 text-amber-800",
};

const PAST_STATUSES = ["Paid", "Closed", "Cancelled", "Expired"];

export function JobCard({ job }: { job: JobDetail }) {
  const router = useRouter();
  const isPastJob = PAST_STATUSES.includes(job.status);

  const handlePostAgain = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const params = new URLSearchParams({
      title: job.title,
      description: job.description,
      categories: job.categories.join(","),
      address: job.address,
      budget: String(job.budgetCents / 100),
    });
    if (job.isRecurring) {
      params.set("isRecurring", "true");
      if (job.recurringFrequency) params.set("recurringFrequency", job.recurringFrequency);
      if (job.recurringDays) params.set("recurringDays", job.recurringDays.join(","));
      if (job.recurringTime) params.set("recurringTime", job.recurringTime);
    }
    router.push(`/jobs/create?${params}`);
  };

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-gray-900 line-clamp-1">{job.title}</h3>
        <div className="flex flex-col items-end gap-1">
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600")}>
            {displayStatus(job.status)}
          </span>
          {job.pendingRequestCount != null && job.pendingRequestCount > 0 && (
            <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">
              {job.pendingRequestCount} request{job.pendingRequestCount > 1 ? "s" : ""}
            </span>
          )}
          {job.assignedVendorName && (
            <span className="rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 text-xs">
              {job.assignedVendorName}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">{job.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {job.pricingType === "hourly" ? (
          <span className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm">
            {formatCents(job.hourlyRateCents ?? 0)}/hr
            <span className="font-normal text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
              ⏱ Est. {job.estimatedHours}h · Max {job.maxHours}h
            </span>
          </span>
        ) : (
          <span className="font-semibold text-gray-900 text-sm">{formatCents(job.budgetCents)}</span>
        )}

        {job.address && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {job.address.split(",")[0]}
          </span>
        )}

        {job.scheduleStart && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(job.scheduleStart).toLocaleDateString()}
          </span>
        )}

        {job.isRecurring && (
          <span className="flex items-center gap-1 text-brand-600 font-medium">
            <RefreshCw className="h-3 w-3" />
            Recurring
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
        {job.categories.map((cat) => (
          <span key={cat} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            <Tag className="h-3 w-3" />
            {CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}

        {isPastJob && (
          <button
            onClick={handlePostAgain}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 transition"
          >
            <RefreshCw className="h-3 w-3" />
            Post Again
          </button>
        )}
      </div>
    </Link>
  );
}
