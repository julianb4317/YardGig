"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, Ban, CheckCircle } from "lucide-react";
import Link from "next/link";

interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: string[];
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
  jobsPosted?: number;
  jobsCompleted?: number;
  totalEarnedCents?: number;
  totalSpentCents?: number;
}

export default function UserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => apiClient<UserDetail>(`/api/admin/users/${id}`),
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiClient(`/api/admin/users/${id}/suspend`, { method: "POST" }),
    onSuccess: () => {
      toast.success("User suspended.");
      queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const unsuspendMutation = useMutation({
    mutationFn: () => apiClient(`/api/admin/users/${id}/unsuspend`, { method: "POST" }),
    onSuccess: () => {
      toast.success("User unsuspended.");
      queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!user) {
    return <p className="text-gray-500">User not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/users" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-gray-500 mt-1">{user.email}</p>
            {user.phone && <p className="text-gray-500 text-sm">{user.phone}</p>}
          </div>
          <div className="flex gap-2">
            {user.isSuspended ? (
              <button
                onClick={() => unsuspendMutation.mutate()}
                disabled={unsuspendMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Unsuspend
              </button>
            ) : (
              <button
                onClick={() => suspendMutation.mutate()}
                disabled={suspendMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                Suspend
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard label="Status" value={user.isSuspended ? "Suspended" : user.isActive ? "Active" : "Inactive"} />
          <InfoCard label="Roles" value={user.roles.join(", ")} />
          <InfoCard label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
          <InfoCard label="Jobs Posted" value={String(user.jobsPosted ?? 0)} />
          <InfoCard label="Jobs Completed" value={String(user.jobsCompleted ?? 0)} />
          <InfoCard label="Total Earned" value={user.totalEarnedCents ? `$${(user.totalEarnedCents / 100).toFixed(2)}` : "$0.00"} />
          <InfoCard label="Total Spent" value={user.totalSpentCents ? `$${(user.totalSpentCents / 100).toFixed(2)}` : "$0.00"} />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
