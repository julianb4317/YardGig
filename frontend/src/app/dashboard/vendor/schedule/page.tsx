"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, MapPin, RefreshCw } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchVendorSchedule } from "@/lib/api/recurring-jobs";
import { formatCents } from "@/lib/utils";

export default function VendorSchedulePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendorSchedule"],
    queryFn: fetchVendorSchedule,
  });

  if (isLoading) return <PageLoader />;

  return (
    <AuthGuard requiredRole="Vendor">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-5 w-5 text-brand-600" />
          <h1 className="text-2xl font-bold">Upcoming Schedule</h1>
        </div>

        {isError && <ErrorState message="Failed to load schedule." onRetry={() => refetch()} />}

        {data && data.length === 0 && (
          <EmptyState
            title="No recurring jobs"
            message="When you're assigned to recurring jobs, your upcoming schedule will appear here."
          />
        )}

        {data && data.length > 0 && (
          <div className="space-y-3">
            {data.map((item) => (
              <Link
                key={item.id}
                href={`/jobs/recurring/${item.id}`}
                className="block rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                      <RefreshCw className="h-3.5 w-3.5" />
                      {item.frequency === "biweekly" ? "Every 2 weeks" : item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)} · {item.days.map(d => d.slice(0, 3)).join(", ")} · {item.time}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCents(item.budgetCents)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  {item.nextOccurrence && (
                    <span className="flex items-center gap-1 text-brand-600 font-medium">
                      <Calendar className="h-3.5 w-3.5" />
                      Next: {new Date(item.nextOccurrence).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {item.address.split(",")[0]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
