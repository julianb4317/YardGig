import Link from "next/link";
import { Calendar, MapPin, Tag } from "lucide-react";
import { formatCents, cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/types";
import type { JobDetail } from "@/lib/types";

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
};

export function JobCard({ job }: { job: JobDetail }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-gray-900 line-clamp-1">{job.title}</h3>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600")}>
          {job.status === "InProgress" ? "In Progress" : job.status}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">{job.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-900 text-sm">{formatCents(job.budgetCents)}</span>

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
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {job.categories.map((cat) => (
          <span key={cat} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            <Tag className="h-3 w-3" />
            {CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}
      </div>
    </Link>
  );
}
