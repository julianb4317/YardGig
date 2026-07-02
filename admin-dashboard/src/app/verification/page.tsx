"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";

interface PendingVendor {
  id: string;
  userId: string;
  businessName: string;
  categories: string[];
  insuranceDocUrl?: string;
  submittedAt: string;
  daysPending: number;
}

export default function VerificationPage() {
  const queryClient = useQueryClient();

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["admin-pending-vendors"],
    queryFn: () => apiClient<PendingVendor[]>("/api/admin/vendors/pending"),
  });

  const approveMutation = useMutation({
    mutationFn: (vendorId: string) =>
      apiClient(`/api/admin/vendors/${vendorId}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Vendor approved.");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-vendors"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const rejectMutation = useMutation({
    mutationFn: (vendorId: string) =>
      apiClient(`/api/admin/vendors/${vendorId}/reject`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Vendor rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-vendors"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Vendor Verification Queue</h2>
        <span className="text-sm text-gray-500">{vendors?.length ?? 0} pending</span>
      </div>

      {vendors?.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500">No pending verifications. All caught up!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {vendors?.map((vendor) => (
          <div
            key={vendor.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{vendor.businessName}</h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {vendor.categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-xs font-medium"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 text-amber-600 text-xs">
                <Clock className="h-3.5 w-3.5" />
                {vendor.daysPending}d pending
              </div>
            </div>

            {vendor.insuranceDocUrl && (
              <a
                href={vendor.insuranceDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 mb-4"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Insurance Document
              </a>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => approveMutation.mutate(vendor.id)}
                disabled={approveMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => rejectMutation.mutate(vendor.id)}
                disabled={rejectMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
