"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useState } from "react";
import { Search, EyeOff, XCircle } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

interface JobRow {
  id: string;
  title: string;
  customerName: string;
  status: string;
  budgetCents: number;
  createdAt: string;
  isHidden: boolean;
}

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Open: "bg-blue-50 text-blue-700",
  Assigned: "bg-indigo-50 text-indigo-700",
  InProgress: "bg-amber-50 text-amber-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-red-50 text-red-700",
};

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["admin-jobs", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiClient<JobRow[]>(`/api/admin/jobs?${params.toString()}`);
    },
  });

  const hideMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiClient(`/api/admin/jobs/${jobId}/hide`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Job hidden.");
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiClient(`/api/admin/jobs/${jobId}/cancel`, { method: "POST" }),
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

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs?.map((job) => (
                <tr key={job.id} className={cn("hover:bg-gray-50 transition", job.isHidden && "opacity-50")}>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[250px] truncate">
                    {job.title}
                    {job.isHidden && <span className="ml-2 text-xs text-red-500">(Hidden)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{job.customerName}</td>
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
                      {!job.isHidden && (
                        <button
                          onClick={() => hideMutation.mutate(job.id)}
                          disabled={hideMutation.isPending}
                          className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                          title="Hide job"
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                      )}
                      {job.status !== "Cancelled" && job.status !== "Completed" && (
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
                </tr>
              ))}
              {jobs?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
