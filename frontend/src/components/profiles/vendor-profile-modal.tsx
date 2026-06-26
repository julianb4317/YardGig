"use client";

import { useQuery } from "@tanstack/react-query";
import { Star, Briefcase, Calendar, MapPin, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { CATEGORY_LABELS } from "@/lib/types";
import { fetchRatings } from "@/lib/api/ratings";

interface VendorPublicData {
  id: string;
  displayName: string;
  businessName: string | null;
  bio: string | null;
  serviceCategories: string[];
  verificationStatus: string;
  averageRating: number;
  totalJobsCompleted: number;
  memberSince: string;
}

interface VendorProfileModalProps {
  vendorProfileId: string;
  vendorName: string;
  open: boolean;
  onClose: () => void;
}

export function VendorProfileModal({ vendorProfileId, vendorName, open, onClose }: VendorProfileModalProps) {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["vendorPublic", vendorProfileId],
    queryFn: () => apiClient<VendorPublicData>(`/api/profiles/vendor/${vendorProfileId}`),
    enabled: open && !!vendorProfileId,
  });

  const { data: ratings } = useQuery({
    queryKey: ["vendorRatings", vendorProfileId],
    queryFn: () => fetchRatings(vendorProfileId, 1, 5),
    enabled: open && !!vendorProfileId,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold">Vendor Profile</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5">
          {profileLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>
          ) : profile ? (
            <>
              {/* Profile header */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-emerald-500 text-white text-xl font-bold">
                  {(profile.businessName ?? profile.displayName).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {profile.businessName ?? profile.displayName}
                  </h3>
                  {profile.businessName && (
                    <p className="text-sm text-gray-500">{profile.displayName}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    {profile.verificationStatus === "Approved" && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-lg font-bold text-gray-900">{profile.averageRating.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Rating</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    <span className="text-lg font-bold text-gray-900">{profile.totalJobsCompleted}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Jobs Done</p>
                </div>
                <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span className="text-lg font-bold text-gray-900">
                      {new Date(profile.memberSince).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Member Since</p>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-gray-700">About</h4>
                  <p className="mt-1 text-sm text-gray-600">{profile.bio}</p>
                </div>
              )}

              {/* Services */}
              {profile.serviceCategories.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700">Services</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.serviceCategories.map((cat) => (
                      <span key={cat} className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                        {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ratings */}
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-gray-700">Recent Reviews</h4>
                {ratings && ratings.items.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {ratings.items.map((r) => (
                      <div key={r.id} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3.5 w-3.5 ${s <= r.score ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
                        <p className="mt-0.5 text-xs text-gray-400">— {r.reviewerName}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400 italic">No reviews yet.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 py-4">Vendor profile not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
