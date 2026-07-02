"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { formatCents, cn } from "@/lib/utils";
import { RefreshCcw } from "lucide-react";

interface Payout {
  id: string;
  vendorName: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

const payoutStatusColors: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700",
  Processing: "bg-blue-50 text-blue-700",
  Completed: "bg-green-50 text-green-700",
  Failed: "bg-red-50 text-red-700",
};

export default function PayoutsPage() {
  const queryClient = useQueryClient();

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () => apiClient<Payout[]>("/api/admin/finance/payouts"),
    refetchOnWindowFocus: false,
  });

  const retryMutation = useMutation({
    mutationFn: (payoutId: string) =>
      apiClient(`/api/admin/finance/payouts/${payoutId}/retry`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Payout retry initiated.");
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Payouts</h2>

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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!isLoading && payouts?.map((payout) => (
              <tr key={payout.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900">{payout.vendorName}</td>
                <td className="px-4 py-3 text-gray-600">{formatCents(payout.amountCents)}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    payoutStatusColors[payout.status] ?? "bg-gray-100 text-gray-600"
                  )}>
                    {payout.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(payout.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {payout.status === "Failed" && (
                    <button
                      onClick={() => retryMutation.mutate(payout.id)}
                      disabled={retryMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && payouts?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No payouts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
