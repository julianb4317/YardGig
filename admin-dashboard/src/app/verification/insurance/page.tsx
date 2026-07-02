"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, XCircle, ExternalLink } from "lucide-react";

interface VendorInsurance {
  id: string;
  name: string;
  businessName: string;
  insuranceCarrier: string;
  insuranceExpiration: string;
  liabilityType: string;
  liabilityAmountCents: number;
  insuranceDocUrl: string;
  insuranceVerified: boolean;
}

export default function InsuranceVerificationPage() {
  const queryClient = useQueryClient();

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["admin-vendors-insurance"],
    queryFn: async () => {
      // Get all vendors (pending have insurance docs to review)
      const pending = await apiClient<VendorInsurance[]>("/api/admin/vendors/pending");
      return pending.filter((v: VendorInsurance) => v.insuranceDocUrl);
    },
    refetchOnWindowFocus: false,
  });

  const verifyMutation = useMutation({
    mutationFn: (vendorId: string) =>
      apiClient(`/api/admin/vendors/${vendorId}/verify-insurance`, { method: "PUT" }),
    onSuccess: () => {
      toast.success("Insurance verified.");
      queryClient.invalidateQueries({ queryKey: ["admin-vendors-insurance"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const rejectMutation = useMutation({
    mutationFn: (vendorId: string) =>
      apiClient(`/api/admin/vendors/${vendorId}/reject-insurance`, { method: "PUT" }),
    onSuccess: () => {
      toast.success("Insurance rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-vendors-insurance"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Insurance Verification</h2>
        <span className="text-sm text-gray-500">
          {vendors?.filter((v) => !v.insuranceVerified).length ?? 0} pending
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isLoading && (
          <div className="h-1 w-full overflow-hidden bg-gray-100">
            <div className="h-full w-1/3 animate-pulse bg-brand-400 rounded" />
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Business</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Carrier</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expiration</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Liability</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!isLoading && vendors?.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900">{vendor.name}</td>
                <td className="px-4 py-3 text-gray-600">{vendor.businessName}</td>
                <td className="px-4 py-3 text-gray-600">{vendor.insuranceCarrier || "—"}</td>
                <td className="px-4 py-3 text-gray-500">
                  {vendor.insuranceExpiration
                    ? new Date(vendor.insuranceExpiration).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {vendor.liabilityType
                    ? `${vendor.liabilityType} — $${((vendor.liabilityAmountCents ?? 0) / 100).toLocaleString()}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {vendor.insuranceDocUrl ? (
                    <a
                      href={vendor.insuranceDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {vendor.insuranceVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!vendor.insuranceVerified && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => verifyMutation.mutate(vendor.id)}
                        disabled={verifyMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verify
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(vendor.id)}
                        disabled={rejectMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && vendors?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
