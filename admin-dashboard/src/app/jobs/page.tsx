"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { useState } from "react";
import { Search, EyeOff, XCircle, ChevronRight } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";
import Link from "next/link";

interface JobRow {
  id: string;
  title: string;
  customerEmail: string;
  status: string;
  budgetCents: number;
  categories: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Open: "bg-blue-50 text-blue-700",
  Assigned: "bg-indigo-50 text-indigo-700",
  InProgress: "bg-amber-50 text-amber-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-red-50 text-red-700",
};

interface JobsResponse {
  jobs: JobRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["admin-jobs", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiClient<JobsResponse>(`/api/admin/jobs?${params.toString()}`);
    },
    refetchOnWindowFocus: false,
  });

  const jobs = jobsData?.jobs;

  const hideMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiClient(`/api/admin/jobs/${jobId}/hide`, { method: "PUT", body: { reason: "Hidden by admin" } }),
    onSuccess: () => {
      toast.success("Job hidden.");
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiClient(`/api/admin/jobs/${jobId}/cancel`, { method: "PUT", body: { reason: "Force cancelled by admin" } }),
    onSuccess: () => {
      toast.success("Job cancelled.");
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Jobs</h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Status</option>
          <option value="Open">Open</option>
          <option value="Assigned">Assigned</option>
          <option value="InProgress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isLoading && (
          <div className="h-1 w-full overflow-hidden bg-gray-100">
            <div className="h-full w-1/3 animate-pulse bg-brand-400 rounded" />
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Budget</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!isLoading && jobs?.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[250px] truncate">
                  {job.title}
                </td>
                <td className="px-4 py-3 text-gray-600">{job.customerEmail}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusColors[job.status] ?? "bg-gray-100 text-gray-600"
                  )}>
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{formatCents(job.budgetCents)}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(job.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {job.status !== "Cancelled" && (
                      <button
                        onClick={() => hideMutation.mutate(job.id)}
                        disabled={hideMutation.isPending}
                        className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                        title="Hide job"
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                    )}
                    {job.status !== "Cancelled" && job.status !== "Completed" && job.status !== "Paid" && (
                      <button
                        onClick={() => cancelMutation.mutate(job.id)}
                        disabled={cancelMutation.isPending}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Force cancel"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/jobs/${job.id}`} className="text-brand-600 hover:text-brand-700">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {!isLoading && jobs?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No jobs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
