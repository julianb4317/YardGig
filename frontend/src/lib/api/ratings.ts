/** Ratings API integration */

import { apiClient } from "@/lib/api-client";

export interface RatingItem {
  id: string;
  jobRequestId: string;
  jobTitle: string;
  reviewerId: string;
  reviewerName: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface RatingsResponse {
  items: RatingItem[];
  totalCount: number;
  averageScore: number;
  page: number;
  pageSize: number;
}

export function fetchRatings(revieweeId: string, page = 1, pageSize = 10) {
  return apiClient<RatingsResponse>(
    `/api/ratings?revieweeId=${revieweeId}&page=${page}&pageSize=${pageSize}`
  );
}

export function submitRating(body: {
  jobRequestId: string;
  revieweeId: string;
  score: number;
  comment?: string;
}) {
  return apiClient<{ ratingId: string }>("/api/ratings", { method: "POST", body });
}
