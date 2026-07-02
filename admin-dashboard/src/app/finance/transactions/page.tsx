"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCents, cn } from "@/lib/utils";
import { useState } from "react";
import { Info } from "lucide-react";

interface Transaction {
  id: string;
  jobTitle: string;
  amountCents: number;
  platformFeeCents: number;
  vendorEarnedCents: number;
  status: string;
  createdAt: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const statusColors: Record<string, string> = {
  Captured: "bg-green-50 text-green-700",
  Refunded: "bg-purple-50 text-purple-700",
  Failed: "bg-red-50 text-red-700",
  Pending: "bg-amber-50 text-amber-700",
};

export default function TransactionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: txData, isLoading } = useQuery({
    queryKey: ["admin-transactions", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiClient<TransactionsResponse>(`/api/admin/finance/transactions?${params.toString()}`);
    },
    refetchOnWindowFocus: false,
  });

  const transactions = txData?.transactions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Status</option>
          <option value="Captured">Captured</option>
          <option value="Refunded">Refunded</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">
          This view connects to the existing payment transactions table via the revenue endpoint.
        </p>
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Job Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Platform Fee</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor Earned</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!isLoading && transactions?.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {tx.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  {tx.jobTitle}
                </td>
                <td className="px-4 py-3 text-gray-600">{formatCents(tx.amountCents)}</td>
                <td className="px-4 py-3 text-gray-600">{formatCents(tx.platformFeeCents)}</td>
                <td className="px-4 py-3 text-gray-600">{formatCents(tx.vendorEarnedCents)}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusColors[tx.status] ?? "bg-gray-100 text-gray-600"
                  )}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!isLoading && transactions?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
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
