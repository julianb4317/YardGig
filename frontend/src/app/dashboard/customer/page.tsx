"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobCard } from "@/components/jobs/job-card";
import { JobListSkeleton } from "@/components/jobs/job-card-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { fetchMyJobs } from "@/lib/api/jobs";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "Open", label: "Open" },
  { value: "Requested", label: "Requested" },
  { value: "Assigned", label: "Assigned" },
  { value: "InProgress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Paid", label: "Paid" },
];

function CustomerJobsList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const status = searchParams.get("status") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["myJobs", status, page],
    queryFn: () => fetchMyJobs({ status: status || undefined, page, pageSize: 10 }),
    refetchInterval: 15_000, // Auto-refresh every 15s to pick up status changes from vendors
  });

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push(`?${params}`);
  };

  return (
    <div>
      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter("status", tab.value)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
              status === tab.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && <JobListSkeleton count={5} />}

      {isError && <ErrorState message="Failed to load your jobs." onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No jobs yet"
          message={status ? `No jobs with status "${status}".` : "Post your first yard work job to get started."}
          action={
            <Link href="/jobs/create" className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
              Post a Job
            </Link>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-3">
            {data.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            totalCount={data.totalCount}
            onPageChange={(p) => setFilter("page", String(p))}
          />
        </>
      )}
    </div>
  );
}

export default function CustomerDashboard() {
  return (
    <AuthGuard requiredRole="Customer">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Jobs</h1>
          <Link
            href="/jobs/create"
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Post Job
          </Link>
        </div>

        <Suspense fallback={<JobListSkeleton />}>
          <CustomerJobsList />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
