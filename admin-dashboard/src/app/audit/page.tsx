"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  oldValuesJson?: string;
  newValuesJson?: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: auditData, isLoading } = useQuery({
    queryKey: ["admin-audit", search, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (actionFilter !== "all") params.set("action", actionFilter);
      return apiClient<AuditResponse>(`/api/admin/audit?${params.toString()}`);
    },
    refetchOnWindowFocus: false,
  });

  const entries = auditData?.entries;

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by actor or entity..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Actions</option>
          <option value="Create">Create</option>
          <option value="Update">Update</option>
          <option value="Delete">Delete</option>
          <option value="Suspend">Suspend</option>
          <option value="Approve">Approve</option>
          <option value="Reject">Reject</option>
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
              <th className="w-8 px-4 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!isLoading && entries?.map((entry) => {
              const isExpanded = expandedRows.has(entry.id);
              const hasDetails = entry.oldValuesJson || entry.newValuesJson;

              return (
                <tr key={entry.id} className="group">
                  <td className="px-4 py-3" colSpan={1}>
                    {hasDetails ? (
                      <button
                        onClick={() => toggleRow(entry.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{entry.actorEmail}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {entry.entityType} <span className="text-gray-400 text-xs">({entry.entityId.slice(0, 8)}…)</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {/* Expanded rows rendered separately */}
            {!isLoading && entries?.map((entry) => {
              const isExpanded = expandedRows.has(entry.id);
              if (!isExpanded) return null;
              const oldValues = entry.oldValuesJson ? JSON.parse(entry.oldValuesJson) : null;
              const newValues = entry.newValuesJson ? JSON.parse(entry.newValuesJson) : null;
              return (
                <tr key={`${entry.id}-detail`} className="bg-gray-50">
                  <td colSpan={5} className="px-8 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {oldValues && (
                        <div>
                          <p className="font-medium text-gray-600 mb-1">Old Values</p>
                          <pre className="bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto text-gray-700">
                            {JSON.stringify(oldValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {newValues && (
                        <div>
                          <p className="font-medium text-gray-600 mb-1">New Values</p>
                          <pre className="bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto text-gray-700">
                            {JSON.stringify(newValues, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && entries?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No audit entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
