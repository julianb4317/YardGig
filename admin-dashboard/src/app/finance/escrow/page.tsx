"use client";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils";
import { Info, Lock } from "lucide-react";

// Placeholder data — GET /api/admin/escrow endpoint does not exist yet
const placeholderEscrows = [
  {
    id: "esc-001",
    jobTitle: "Lawn Mowing — 123 Oak St",
    customerName: "John Smith",
    amountHeldCents: 15000,
    status: "Authorized",
    createdAt: "2024-12-20T10:30:00Z",
  },
  {
    id: "esc-002",
    jobTitle: "Tree Trimming — 456 Pine Ave",
    customerName: "Sarah Johnson",
    amountHeldCents: 45000,
    status: "Held",
    createdAt: "2024-12-19T14:15:00Z",
  },
  {
    id: "esc-003",
    jobTitle: "Snow Removal — 789 Elm Dr",
    customerName: "Mike Davis",
    amountHeldCents: 8500,
    status: "Authorized",
    createdAt: "2024-12-21T08:00:00Z",
  },
];

const escrowStatusColors: Record<string, string> = {
  Authorized: "bg-blue-50 text-blue-700",
  Held: "bg-amber-50 text-amber-700",
  Released: "bg-green-50 text-green-700",
  Voided: "bg-gray-100 text-gray-600",
};

export default function EscrowPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Escrow Monitor</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Lock className="h-4 w-4" />
          {placeholderEscrows.length} active holds
        </div>
      </div>

      {/* Placeholder notice */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">
          Showing placeholder data.{" "}
          <code className="bg-blue-100 px-1 rounded text-xs">GET /api/admin/escrow</code>{" "}
          endpoint is not yet implemented on the backend.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Job Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Amount Held</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {placeholderEscrows.map((escrow) => (
              <tr key={escrow.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[250px] truncate">
                  {escrow.jobTitle}
                </td>
                <td className="px-4 py-3 text-gray-600">{escrow.customerName}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">
                  {formatCents(escrow.amountHeldCents)}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    escrowStatusColors[escrow.status] ?? "bg-gray-100 text-gray-600"
                  )}>
                    {escrow.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(escrow.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {placeholderEscrows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
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
