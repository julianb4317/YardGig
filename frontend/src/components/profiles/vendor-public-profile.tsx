"use client";

import { useQuery } from "@tanstack/react-query";
import { Star, Briefcase, Calendar } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { CATEGORY_LABELS } from "@/lib/types";

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

function fetchVendorPublic(vendorProfileId: string) {
  return apiClient<VendorPublicData>(`/api/profiles/vendor/${vendorProfileId}`);
}

export function VendorPublicProfile({ vendorProfileId }: { vendorProfileId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vendorPublic", vendorProfileId],
    queryFn: () => fetchVendorPublic(vendorProfileId),
    enabled: !!vendorProfileId,
  });

  if (isLoading) return <Spinner className="mx-auto my-4" />;
  if (!data) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-5 bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-lg">
          {data.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{data.displayName}</h4>
          {data.businessName && <p className="text-sm text-gray-500">{data.businessName}</p>}
        </div>
      </div>

      {data.bio && (
        <p className="mt-3 text-sm text-gray-600">{data.bio}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-yellow-600">
          <Star className="h-4 w-4 fill-current" aria-hidden="true" />
          {data.averageRating.toFixed(1)}
        </span>
        <span className="flex items-center gap-1 text-gray-500">
          <Briefcase className="h-4 w-4" /> {data.totalJobsCompleted} jobs
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          <Calendar className="h-4 w-4" /> Member since {new Date(data.memberSince).toLocaleDateString()}
        </span>
      </div>

      {data.serviceCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.serviceCategories.map((cat) => (
            <span key={cat} className="rounded-md bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
