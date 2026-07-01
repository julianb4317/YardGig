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
  businessAddress: string | null;
  businessLatitude: number | null;
  businessLongitude: number | null;
  insuranceCarrier: string | null;
  insuranceExpirationDate: string | null;
  insuranceLiabilityType: string | null;
  insuranceLiabilityAmountCents: number | null;
  insuranceDocUrl: string | null;
  insuranceVerified: boolean;
  stripeOnboarded: boolean;
}

export interface CustomerProfile {
  id: string;
  businessName: string | null;
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
  businessAddress?: string;
  insuranceCarrier?: string;
  insuranceExpirationDate?: string;
  insuranceLiabilityType?: string;
  insuranceLiabilityAmountCents?: number;
}) {
  return apiClient("/api/profiles/vendor/me", { method: "PUT", body: data });
}

export function fetchCustomerProfile() {
  return apiClient<CustomerProfile>("/api/profiles/customer/me");
}

export function updateCustomerProfile(data: { defaultAddress?: string; businessName?: string }) {
  return apiClient("/api/profiles/customer/me", { method: "PUT", body: data });
}
