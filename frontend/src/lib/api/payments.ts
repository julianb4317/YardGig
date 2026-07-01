/** Payments API integration */

import { apiClient } from "@/lib/api-client";

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

export function getPaymentStatus(jobId: string) {
  return apiClient<PaymentStatus>(`/api/payments/job/${jobId}`);
}
