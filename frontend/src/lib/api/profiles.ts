/** Profiles API integration */

import { apiClient } from "@/lib/api-client";

export interface VendorProfile {
  id: string;
  businessName: string | null;
  bio: string | null;
  serviceCategories: string[];
  serviceRadiusMiles: number;
  latitude: number | null;
  longitude: number | null;
  verificationStatus: string;
  averageRating: number;
  totalJobsCompleted: number;
}

export interface CustomerProfile {
  id: string;
  defaultAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  hasPaymentMethod: boolean;
}

export function fetchVendorProfile() {
  return apiClient<VendorProfile>("/api/profiles/vendor/me");
}

export function updateVendorProfile(data: {
  businessName?: string;
  bio?: string;
  serviceCategories?: string[];
  serviceRadiusMiles?: number;
  address?: string;
  insuranceDocUrl?: string;
}) {
  return apiClient("/api/profiles/vendor/me", { method: "PUT", body: data });
}

export function fetchCustomerProfile() {
  return apiClient<CustomerProfile>("/api/profiles/customer/me");
}

export function updateCustomerProfile(data: { defaultAddress?: string }) {
  return apiClient("/api/profiles/customer/me", { method: "PUT", body: data });
}
