"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisputeRow {
  id: string;
  disputeNumber: string;
  jobTitle: string;
  jobId: string;
  raisedByName: string;
  reason: string;
  status: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  Open: "bg-amber-50 text-amber-700",
  InReview: "bg-blue-50 text-blue-700",
  Resolved: "bg-green-50 text-green-700",
  Closed: "bg-gray-100 text-gray-600",
};

export default function DisputesPage() {
  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => apiClient<DisputeRow[]>("/api/admin/disputes"),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Disputes</h2>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dispute #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Job</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Raised By</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Age</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {disputes?.map((d) => {
              const age = Math.floor(
                (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <tr key={d.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{d.disputeNumber}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{d.jobTitle}</td>
                  <td className="px-4 py-3 text-gray-600">{d.raisedByName}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{d.reason}</td>
                  <td className="px-4 py-3 text-gray-500">{age}d</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusColors[d.status] ?? "bg-gray-100 text-gray-600"
                      )}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/disputes/${d.id}`} className="text-brand-600 hover:text-brand-700">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {disputes?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No disputes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
