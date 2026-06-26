"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Check, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/spinner";
import { fetchNotifications, markNotificationRead } from "@/lib/api/notifications";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/api/notifications";

const TYPE_ICONS: Record<string, typeof Bell> = {
  vendor_requested: Mail,
  job_assigned: Check,
  job_cancelled: AlertCircle,
  payment_received: Check,
};

function NotificationRow({ item, onMarkRead }: { item: NotificationItem; onMarkRead: (id: string) => void }) {
  const Icon = TYPE_ICONS[item.type] ?? Bell;
  const timeAgo = getTimeAgo(item.createdAt);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition",
        item.isRead ? "bg-white border-gray-100" : "bg-blue-50 border-blue-100"
      )}
      role="listitem"
      aria-label={`${item.isRead ? "" : "Unread: "}${item.title}`}
    >
      <div className={cn("rounded-full p-2", item.isRead ? "bg-gray-100" : "bg-blue-100")}>
        <Icon className={cn("h-4 w-4", item.isRead ? "text-gray-500" : "text-blue-600")} aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", item.isRead ? "text-gray-600" : "text-gray-900 font-medium")}>
          {item.title}
        </p>
        {item.body && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{item.body}</p>}
        <p className="mt-1 text-xs text-gray-400">{timeAgo}</p>
      </div>

      {!item.isRead && (
        <button
          onClick={() => onMarkRead(item.id)}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 border border-brand-200"
          aria-label={`Mark "${item.title}" as read`}
          title="Mark as read"
        >
          Mark read
        </button>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () => fetchNotifications(filter === "unread", 100),
    refetchInterval: 30_000, // Poll every 30s
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      // Optimistic update: immediately mark as read in the local cache
      await queryClient.cancelQueries({ queryKey: ["notifications", filter] });
      const previous = queryClient.getQueryData<any[]>(["notifications", filter]);
      queryClient.setQueryData(["notifications", filter], (old: any[] | undefined) =>
        old?.map((n) => n.id === id ? { ...n, isRead: true } : n)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Revert on failure
      queryClient.setQueryData(["notifications", filter], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiClient<{ markedCount: number }>("/api/notifications/read-all", { method: "PUT" }),
    onSuccess: (data) => {
      toast.success(`Marked ${data.markedCount} as read.`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const unreadCount = data?.filter((n) => !n.isRead).length ?? 0;

  if (isLoading) return <PageLoader />;

  return (
    <AuthGuard>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">{unreadCount} unread</p>
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Mark all read
                </button>
              </div>
            )}
          </div>

          <div className="flex rounded-lg border overflow-hidden" role="tablist" aria-label="Notification filter">
            <button
              role="tab"
              aria-selected={filter === "all"}
              onClick={() => setFilter("all")}
              className={cn("px-4 py-1.5 text-sm font-medium", filter === "all" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50")}
            >
              All
            </button>
            <button
              role="tab"
              aria-selected={filter === "unread"}
              onClick={() => setFilter("unread")}
              className={cn("px-4 py-1.5 text-sm font-medium", filter === "unread" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50")}
            >
              Unread
            </button>
          </div>
        </div>

        {isError && <ErrorState message="Failed to load notifications." onRetry={() => refetch()} />}

        {data && data.length === 0 && (
          <EmptyState
            title={filter === "unread" ? "All caught up!" : "No notifications yet"}
            message={filter === "unread" ? "You have no unread notifications." : "Notifications will appear here as activity happens."}
          />
        )}

        {data && data.length > 0 && (
          <div className="space-y-2" role="list" aria-label="Notifications list">
            {data.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onMarkRead={(id) => markReadMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
