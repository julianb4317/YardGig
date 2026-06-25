/** Payments API integration */

import { apiClient } from "@/lib/api-client";

export interface InitiatePaymentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  platformFeeCents: number;
  vendorNetCents: number;
}

export interface PaymentStatus {
  hasPayment: boolean;
  transaction?: {
    id: string;
    status: string;
    amountCents: number;
    platformFeeCents: number;
    vendorPayoutCents: number;
    capturedAt: string | null;
    createdAt: string;
  };
}

export function initiatePayment(jobRequestId: string) {
  return apiClient<InitiatePaymentResponse>("/api/payments/initiate", {
    method: "POST",
    body: { jobRequestId },
  });
}

export function capturePayment(jobRequestId: string) {
  return apiClient<{ transactionId: string }>("/api/payments/capture", {
    method: "POST",
    body: { jobRequestId },
  });
}

export function getPaymentStatus(jobId: string) {
  return apiClient<PaymentStatus>(`/api/payments/job/${jobId}`);
}
