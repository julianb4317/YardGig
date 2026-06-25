"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { MapPin, Filter } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobListSkeleton } from "@/components/jobs/job-card-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchJobsByBounds } from "@/lib/api/jobs";
import { formatCents, cn } from "@/lib/utils";
import { CATEGORY_LABELS, JOB_CATEGORIES } from "@/lib/types";
import type { MapPin as MapPinType } from "@/lib/types";
import Link from "next/link";

// Default bounds: Denver metro area (used when no geolocation)
const DEFAULT_BOUNDS = { minLat: 39.6, maxLat: 39.85, minLng: -105.1, maxLng: -104.85 };

function VendorJobCard({ pin }: { pin: MapPinType }) {
  const distanceMiles = (pin.distanceMeters / 1609.34).toFixed(1);

  return (
    <Link
      href={`/jobs/${pin.id}`}
      className={cn(
        "block rounded-lg border p-4 transition",
        pin.vendorRequested
          ? "border-gray-200 bg-gray-50 opacity-70"
          : "border-gray-200 hover:border-brand-300 hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-gray-900 line-clamp-1">{pin.title}</h3>
        {pin.vendorRequested && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            Requested ✓
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span className="font-semibold text-gray-900">{formatCents(pin.budgetCents)}</span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {distanceMiles} mi
        </span>
        {pin.scheduleStart && (
          <span>{new Date(pin.scheduleStart).toLocaleDateString()}</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {pin.categories.map((cat) => (
          <span key={cat} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}
      </div>
    </Link>
  );
}

function VendorJobsList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [filterOpen, setFilterOpen] = useState(false);

  const categories = searchParams.get("categories") ?? "";
  const minBudget = searchParams.get("minBudget");
  const maxBudget = searchParams.get("maxBudget");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendorJobs", categories, minBudget, maxBudget],
    queryFn: () =>
      fetchJobsByBounds({
        ...DEFAULT_BOUNDS,
        categories: categories || undefined,
        minBudget: minBudget ? Number(minBudget) : undefined,
        maxBudget: maxBudget ? Number(maxBudget) : undefined,
        limit: 50,
      }),
  });

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params}`);
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {data ? `${data.pins.length} jobs nearby` : "Loading..."}
          {data?.truncated && ` (showing ${data.pins.length} of ${data.totalInBounds})`}
        </p>
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" /> Filters
        </button>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="mb-4 rounded-lg border bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Categories</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {JOB_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  const current = categories.split(",").filter(Boolean);
                  const updated = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
                  setFilter("categories", updated.join(","));
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition",
                  categories.includes(cat)
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Budget Range</p>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min $"
              defaultValue={minBudget ?? ""}
              onBlur={(e) => setFilter("minBudget", e.target.value ? String(Number(e.target.value) * 100) : "")}
              className="w-24 rounded-md border px-2 py-1 text-sm"
            />
            <input
              type="number"
              placeholder="Max $"
              defaultValue={maxBudget ? String(Number(maxBudget) / 100) : ""}
              onBlur={(e) => setFilter("maxBudget", e.target.value ? String(Number(e.target.value) * 100) : "")}
              className="w-24 rounded-md border px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading && <JobListSkeleton count={6} />}
      {isError && <ErrorState message="Failed to load nearby jobs." onRetry={() => refetch()} />}

      {data && data.pins.length === 0 && (
        <EmptyState
          title="No jobs in this area"
          message="Try zooming out or changing filters."
        />
      )}

      {data && data.pins.length > 0 && (
        <div className="space-y-3">
          {data.pins.map((pin) => (
            <VendorJobCard key={pin.id} pin={pin} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorDashboard() {
  return (
    <AuthGuard requiredRole="Vendor">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Available Jobs</h1>
          <span className="text-xs rounded-full bg-blue-50 px-2.5 py-1 text-blue-600 font-medium">
            📍 List View — Map coming soon
          </span>
        </div>

        <Suspense fallback={<JobListSkeleton />}>
          <VendorJobsList />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
