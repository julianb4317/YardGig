"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { formatCents, cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  EyeOff,
  XCircle,
  Calendar,
  DollarSign,
  User,
  Briefcase,
  Image,
} from "lucide-react";

interface JobDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  budgetCents: number;
  pricingType: string;
  scheduledDate?: string;
  customerName: string;
  customerEmail: string;
  vendorName?: string;
  vendorEmail?: string;
  isHidden: boolean;
  photos?: string[];
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Open: "bg-blue-50 text-blue-700",
  Assigned: "bg-indigo-50 text-indigo-700",
  InProgress: "bg-amber-50 text-amber-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-red-50 text-red-700",
};

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["admin-job", id],
    queryFn: () => apiClient<JobDetail>(`/api/admin/jobs/${id}`),
    refetchOnWindowFocus: false,
  });

  const hideMutation = useMutation({
    mutationFn: () =>
      apiClient(`/api/admin/jobs/${id}/hide`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Job hidden.");
      queryClient.invalidateQueries({ queryKey: ["admin-job", id] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiClient(`/api/admin/jobs/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Job force-cancelled.");
      queryClient.invalidateQueries({ queryKey: ["admin-job", id] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!job) {
    return <p className="text-gray-500">Job not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Jobs
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Created {new Date(job.createdAt).toLocaleDateString()}
              {job.isHidden && <span className="ml-2 text-red-500 font-medium">(Hidden)</span>}
            </p>
          </div>
          <span className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            statusColors[job.status] ?? "bg-gray-100 text-gray-600"
          )}>
            {job.status}
          </span>
        </div>

        {/* Description */}
        {job.description && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-1">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <User className="h-3.5 w-3.5" /> Customer
            </div>
            <p className="font-medium text-gray-900">{job.customerName}</p>
            <p className="text-gray-500 text-xs">{job.customerEmail}</p>
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Briefcase className="h-3.5 w-3.5" /> Vendor
            </div>
            {job.vendorName ? (
              <>
                <p className="font-medium text-gray-900">{job.vendorName}</p>
                <p className="text-gray-500 text-xs">{job.vendorEmail}</p>
              </>
            ) : (
              <p className="text-gray-400">Not assigned</p>
            )}
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Budget &amp; Pricing
            </div>
            <p className="font-medium text-gray-900">{formatCents(job.budgetCents)}</p>
            <p className="text-gray-500 text-xs capitalize">{job.pricingType}</p>
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Calendar className="h-3.5 w-3.5" /> Schedule
            </div>
            <p className="font-medium text-gray-900">
              {job.scheduledDate
                ? new Date(job.scheduledDate).toLocaleDateString()
                : "Flexible"}
            </p>
          </div>
        </div>

        {/* Photos */}
        {job.photos && job.photos.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Image className="h-3.5 w-3.5" /> Photos ({job.photos.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {job.photos.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-20 w-20 rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-brand-400 transition"
                >
                  <img src={url} alt={`Job photo ${i + 1}`} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {job.status !== "Cancelled" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Admin Actions</h3>
          <div className="flex gap-3">
            {!job.isHidden && (
              <button
                onClick={() => hideMutation.mutate()}
                disabled={hideMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                <EyeOff className="h-4 w-4" />
                Hide Job
              </button>
            )}
            {job.status !== "Completed" && (
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Force Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
