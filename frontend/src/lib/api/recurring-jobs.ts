/** Recurring Jobs API integration */

import { apiClient } from "@/lib/api-client";

export interface RecurringSeries {
  id: string;
  templateJobId: string;
  templateTitle: string;
  budgetCents: number;
  frequency: string;
  days: string[];
  time: string;
  status: string;
  nextOccurrence: string | null;
  totalOccurrences: number;
  createdAt: string;
  assignedVendorName: string | null;
}

export interface RecurringSeriesDetail extends RecurringSeries {
  templateDescription: string;
  categories: string[];
  assignedVendorProfileId: string | null;
  occurrences: {
    id: string;
    title: string;
    status: string;
    scheduleStart: string | null;
    budgetCents: number;
    createdAt: string;
  }[];
}

export interface VendorScheduleItem {
  id: string;
  templateJobId: string;
  title: string;
  budgetCents: number;
  address: string;
  frequency: string;
  days: string[];
  time: string;
  nextOccurrence: string | null;
}

export function fetchMySeries() {
  return apiClient<RecurringSeries[]>("/api/recurring-jobs/mine");
}

export function fetchSeriesDetail(id: string) {
  return apiClient<RecurringSeriesDetail>(`/api/recurring-jobs/${id}`);
}

export function pauseSeries(id: string) {
  return apiClient<{ status: string }>(`/api/recurring-jobs/${id}/pause`, { method: "PUT" });
}

export function resumeSeries(id: string) {
  return apiClient<{ status: string; nextOccurrence?: string }>(`/api/recurring-jobs/${id}/resume`, { method: "PUT" });
}

export function cancelSeries(id: string) {
  return apiClient<{ status: string }>(`/api/recurring-jobs/${id}/cancel`, { method: "PUT" });
}

export function fetchVendorSchedule() {
  return apiClient<VendorScheduleItem[]>("/api/recurring-jobs/vendor/schedule");
}

export function withdrawFromSeries(id: string) {
  return apiClient<{ success: boolean }>(`/api/recurring-jobs/${id}/withdraw`, { method: "PUT" });
}
