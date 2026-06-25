/**
 * Strict TypeScript types matching backend DTOs.
 * Every API response has a corresponding type — no `any` allowed.
 */

// ─── Enums (matching backend) ───

export const JobStatuses = [
  "Draft", "Open", "Requested", "Assigned", "InProgress",
  "Completed", "Paid", "Closed", "Cancelled", "Disputed",
] as const;
export type JobStatus = (typeof JobStatuses)[number];

export const VendorRequestStatuses = ["Pending", "Accepted", "Rejected", "Withdrawn"] as const;
export type VendorRequestStatus = (typeof VendorRequestStatuses)[number];

export const VerificationStatuses = ["Pending", "Approved", "Rejected"] as const;
export type VerificationStatus = (typeof VerificationStatuses)[number];

// ─── Job ───

export interface JobDetail {
  id: string;
  title: string;
  description: string;
  categories: string[];
  address: string;
  latitude: number;
  longitude: number;
  status: JobStatus;
  budgetCents: number;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  photos: string[] | null;
  createdAt: string;
  customerProfileId: string;
  pendingRequestCount?: number;
  assignedVendorName?: string | null;
}

export interface MapPin {
  id: string;
  title: string;
  categories: string[];
  budgetCents: number;
  latitude: number;
  longitude: number;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  distanceMeters: number;
  vendorRequested: boolean;
  expiresAt: string | null;
}

export interface MapQueryResponse {
  pins: MapPin[];
  totalInBounds: number;
  truncated: boolean;
}

// ─── Pagination ───

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ─── Vendor Requests ───

export interface VendorRequestDto {
  vendorRequestId: string;
  vendorProfileId: string;
  vendorName: string;
  businessName: string | null;
  averageRating: number;
  totalJobsCompleted: number;
  proposedPriceCents: number | null;
  note: string | null;
  distanceMeters: number | null;
  status: VendorRequestStatus;
  createdAt: string;
}

export interface VendorMyRequest {
  vendorRequestId: string;
  jobId: string;
  jobTitle: string;
  budgetCents: number;
  status: VendorRequestStatus;
  proposedPriceCents: number | null;
  createdAt: string;
}

// ─── Auth ───

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
  roles: string[];
}

export interface LoginResponse extends Partial<AuthResponse> {
  requiresMfa?: boolean;
  requiresEmailVerification?: boolean;
  userId?: string;
}

export interface RegisterResponse {
  userId: string;
  roles: string[];
  message: string;
}

// ─── Profiles ───

export interface VendorProfile {
  id: string;
  businessName: string | null;
  bio: string | null;
  serviceCategories: string[];
  serviceRadiusMiles: number;
  latitude: number | null;
  longitude: number | null;
  verificationStatus: VerificationStatus;
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

// ─── Notifications ───

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

// ─── Categories ───

export const JOB_CATEGORIES = [
  "mowing",
  "hedging",
  "leaf_removal",
  "snow_clearing",
  "general",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  mowing: "Mowing",
  hedging: "Hedge Trimming",
  leaf_removal: "Leaf Removal",
  snow_clearing: "Snow Clearing",
  general: "General Yard Work",
};

// ─── API Error ───

export interface ApiErrorResponse {
  errors?: string[];
  error?: string;
}
