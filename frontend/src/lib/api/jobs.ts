/** Jobs API integration layer */

import { apiClient } from "@/lib/api-client";
import type { JobDetail, MapQueryResponse, PaginatedResult, VendorRequestDto } from "@/lib/types";

// ─── Customer: My Jobs ───

export function fetchMyJobs(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  return apiClient<PaginatedResult<JobDetail>>(`/api/jobs/mine?${search}`);
}

// ─── Job Detail ───

export function fetchJobDetail(id: string) {
  return apiClient<JobDetail>(`/api/jobs/${id}`);
}

// ─── Create Job ───

export interface CreateJobPayload {
  title: string;
  description: string;
  categories: string[];
  address: string;
  budgetCents: number;
  scheduleStart?: string;
  scheduleEnd?: string;
  photos?: string[];
  isRecurring?: boolean;
  recurringFrequency?: string;
  recurringDays?: string[];
  recurringTime?: string;
}

export function createJob(payload: CreateJobPayload) {
  return apiClient<{ id: string }>("/api/jobs", {
    method: "POST",
    body: payload,
  });
}

// ─── Vendor: Browse Jobs by Bounds ───

export function fetchJobsByBounds(params: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  categories?: string;
  minBudget?: number;
  maxBudget?: number;
  limit?: number;
}) {
  const search = new URLSearchParams({
    minLat: String(params.minLat),
    maxLat: String(params.maxLat),
    minLng: String(params.minLng),
    maxLng: String(params.maxLng),
  });
  if (params.categories) search.set("categories", params.categories);
  if (params.minBudget) search.set("minBudget", String(params.minBudget));
  if (params.maxBudget) search.set("maxBudget", String(params.maxBudget));
  if (params.limit) search.set("limit", String(params.limit));

  return apiClient<MapQueryResponse>(`/api/jobs/map?${search}`);
}

// ─── Vendor: Request Job ───

export function requestJob(jobId: string, body?: { proposedPriceCents?: number; note?: string }) {
  return apiClient<{ vendorRequestId: string }>(`/api/jobs/${jobId}/requests`, {
    method: "POST",
    body: body ?? {},
  });
}

// ─── Customer: Vendor Requests for a Job ───

export function fetchJobRequests(jobId: string) {
  return apiClient<VendorRequestDto[]>(`/api/jobs/${jobId}/requests`);
}

// ─── Customer: Assign Vendor ───

export function assignVendor(jobId: string, vendorRequestId: string) {
  return apiClient(`/api/jobs/${jobId}/assign`, {
    method: "PUT",
    body: { vendorRequestId },
  });
}

// ─── Job Status Update ───

export function updateJobStatus(jobId: string, status: string, completionPhotos?: string[]) {
  return apiClient(`/api/jobs/${jobId}/status`, {
    method: "PUT",
    body: { status, completionPhotos },
  });
}

// ─── Cancel Job ───

export function cancelJob(jobId: string, reason?: string) {
  return apiClient<{ message: string; penaltyApplied: boolean }>(`/api/jobs/${jobId}/cancel`, {
    method: "PUT",
    body: { reason },
  });
}
