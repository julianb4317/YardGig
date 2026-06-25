/** Notifications API integration */

import { apiClient } from "@/lib/api-client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  eventType: string;
  channel: string;
  enabled: boolean;
  updatedAt: string;
}

export function fetchNotifications(unreadOnly = false, limit = 50) {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unreadOnly", "true");
  params.set("limit", String(limit));
  return apiClient<NotificationItem[]>(`/api/notifications?${params}`);
}

export function markNotificationRead(id: string) {
  return apiClient(`/api/notifications/${id}/read`, { method: "PUT" });
}

export function fetchPreferences() {
  return apiClient<NotificationPreference[]>("/api/notifications/preferences");
}

export function updatePreferences(preferences: { eventType: string; channel: string; enabled: boolean }[]) {
  return apiClient("/api/notifications/preferences", {
    method: "PUT",
    body: { preferences },
  });
}

export function unsubscribeAll() {
  return apiClient("/api/notifications/preferences/unsubscribe-all", { method: "PUT" });
}
