"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt: string;
}

interface UsersResponse {
  users: UserRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
      return apiClient<UsersResponse>(`/api/admin/users?${params.toString()}`);
    },
    refetchOnWindowFocus: false,
  });

  const users = usersData?.users;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Users</h2>
        <Link
          href="/settings#create-user"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <UserPlus className="h-4 w-4" />
          + New User
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Roles</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!isLoading && users?.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {user.displayName}
                </td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      user.isActive
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    )}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${user.id}`}
                    className="text-brand-600 hover:text-brand-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {!isLoading && users?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
