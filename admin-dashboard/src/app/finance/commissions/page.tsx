"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Plus, XCircle } from "lucide-react";

interface Commission {
  id: string;
  scope: string;
  key: string;
  ratePercent: number;
  isActive: boolean;
  createdAt: string;
}

export default function CommissionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newScope, setNewScope] = useState("global");
  const [newKey, setNewKey] = useState("");
  const [newRate, setNewRate] = useState("");

  const { data: commissions, isLoading } = useQuery({
    queryKey: ["admin-commissions"],
    queryFn: () => apiClient<Commission[]>("/api/admin/finance/commissions"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient("/api/admin/finance/commissions", {
        method: "POST",
        body: { scope: newScope, key: newKey || null, ratePercent: parseFloat(newRate) },
      }),
    onSuccess: () => {
      toast.success("Commission rate created.");
      queryClient.invalidateQueries({ queryKey: ["admin-commissions"] });
      setShowForm(false);
      setNewScope("global");
      setNewKey("");
      setNewRate("");
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/admin/finance/commissions/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Commission rate deactivated.");
      queryClient.invalidateQueries({ queryKey: ["admin-commissions"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Commissions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Rate
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Create Commission Rate</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="global">Global</option>
                <option value="category">Category</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key (optional)</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g., category name or vendor ID"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate (%)</label>
              <input
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="e.g., 15"
                step="0.1"
                min="0"
                max="100"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newRate || createMutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Commissions table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Scope</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Key</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rate</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {commissions?.map((c) => (
              <tr key={c.id} className={cn("hover:bg-gray-50 transition", !c.isActive && "opacity-50")}>
                <td className="px-4 py-3 font-medium text-gray-900 capitalize">{c.scope}</td>
                <td className="px-4 py-3 text-gray-600">{c.key || "—"}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{c.ratePercent}%</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    c.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  )}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.isActive && (
                    <button
                      onClick={() => deactivateMutation.mutate(c.id)}
                      disabled={deactivateMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg text-xs text-red-600 hover:bg-red-50 px-2 py-1"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {commissions?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No commission rates configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
