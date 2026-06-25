/** Disputes API integration */

import { apiClient } from "@/lib/api-client";

export interface DisputeItem {
  id: string;
  jobRequestId: string;
  jobTitle: string;
  reason: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function fetchMyDisputes() {
  return apiClient<DisputeItem[]>("/api/disputes/mine");
}

export function raiseDispute(jobRequestId: string, reason: string) {
  return apiClient<{ disputeId: string }>("/api/disputes", {
    method: "POST",
    body: { jobRequestId, reason },
  });
}
