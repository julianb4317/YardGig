"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { fetchNotifications } from "@/lib/api/notifications";
import { isAuthenticated } from "@/lib/auth";

export function NotificationBell() {
  const authenticated = isAuthenticated();

  const { data } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: () => fetchNotifications(true, 1),
    enabled: authenticated,
    refetchInterval: 30_000,
  });

  const unreadCount = data?.length ?? 0;

  if (!authenticated) return null;

  return (
    <Link
      href="/notifications"
      className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
