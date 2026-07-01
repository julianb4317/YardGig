/** Customer Addresses API */

import { apiClient } from "@/lib/api-client";

export interface CustomerAddress {
  id: string;
  label: string;
  isDefault: boolean;
  formattedAddress: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  jobDetailsJson: string | null;
  createdAt: string;
}

export function fetchAddresses() {
  return apiClient<CustomerAddress[]>("/api/customer/addresses");
}

export function addAddress(body: {
  label: string;
  formattedAddress: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  isDefault?: boolean;
  jobDetailsJson?: string;
}) {
  return apiClient<{ id: string; isDefault: boolean }>("/api/customer/addresses", {
    method: "POST",
    body,
  });
}

export function updateAddress(id: string, body: {
  label?: string;
  formattedAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  isDefault?: boolean;
  jobDetailsJson?: string;
}) {
  return apiClient<{ success: boolean }>(`/api/customer/addresses/${id}`, {
    method: "PUT",
    body,
  });
}

export function deleteAddress(id: string) {
  return apiClient<{ success: boolean }>(`/api/customer/addresses/${id}`, {
    method: "DELETE",
  });
}

export function setDefaultAddress(id: string) {
  return apiClient<{ success: boolean }>(`/api/customer/addresses/${id}/default`, {
    method: "PUT",
  });
}
