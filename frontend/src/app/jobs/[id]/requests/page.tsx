"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Star, MapPin, DollarSign, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VendorProfileModal } from "@/components/profiles/vendor-profile-modal";
import { fetchJobRequests, assignVendor } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api-client";
import type { VendorRequestDto } from "@/lib/types";
import { formatCents } from "@/lib/utils";

function VendorRequestCard({
  req,
  onAccept,
  isAssigning,
}: {
  req: VendorRequestDto;
  onAccept: (vendorRequestId: string) => void;
  isAssigning: boolean;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const distanceMiles = req.distanceMeters ? (req.distanceMeters / 1609.34).toFixed(1) : null;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            onClick={() => setProfileOpen(true)}
            className="font-medium text-brand-600 hover:text-brand-700 hover:underline text-left"
          >
            {req.vendorName}
          </button>
          {req.businessName && <p className="text-sm text-gray-500">{req.businessName}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          req.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
          req.status === "Accepted" ? "bg-green-100 text-green-800" :
          "bg-gray-100 text-gray-600"
        }`}>
          {req.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-yellow-500" />
          {req.averageRating.toFixed(1)} ({req.totalJobsCompleted} jobs)
        </span>
        {distanceMiles && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {distanceMiles} mi
          </span>
        )}
        {req.proposedPriceCents && (
          <span className="flex items-center gap-1 font-medium text-gray-700">
            <DollarSign className="h-3.5 w-3.5" /> {formatCents(req.proposedPriceCents)}
          </span>
        )}
      </div>

      {req.note && (
        <p className="mt-2 text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">"{req.note}"</p>
      )}

      {req.status === "Pending" && (
        <div className="mt-3">
          <button
            onClick={() => onAccept(req.vendorRequestId)}
            disabled={isAssigning}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {isAssigning ? "Assigning..." : "Accept Vendor"}
          </button>
        </div>
      )}

      <VendorProfileModal
        vendorProfileId={req.vendorProfileId}
        vendorName={req.vendorName}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
}

export default function JobRequestsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const { data: requests, isLoading, isError, refetch } = useQuery({
    queryKey: ["jobRequests", id],
    queryFn: () => fetchJobRequests(id),
    enabled: !!id,
  });

  const assignMutation = useMutation({
    mutationFn: (vendorRequestId: string) => assignVendor(id, vendorRequestId),
    onSuccess: () => {
      toast.success("Vendor assigned! They've been notified.");
      setConfirmTarget(null);
      queryClient.invalidateQueries({ queryKey: ["jobRequests", id] });
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      router.push(`/jobs/${id}`);
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to assign vendor.");
      setConfirmTarget(null);
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <AuthGuard requiredRole="Customer">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Vendor Requests</h1>
        <p className="mt-1 text-sm text-gray-500">Review and accept a vendor for your job.</p>

        {isError && <ErrorState message="Failed to load requests." onRetry={() => refetch()} />}

        {requests && requests.length === 0 && (
          <EmptyState
            title="No requests yet"
            message="Vendors will see your job on the map and send requests. Check back soon!"
          />
        )}

        {requests && requests.length > 0 && (
          <div className="mt-6 space-y-4">
            {requests.map((req) => (
              <VendorRequestCard
                key={req.vendorRequestId}
                req={req}
                onAccept={(vrId) => setConfirmTarget(vrId)}
                isAssigning={assignMutation.isPending}
              />
            ))}
          </div>
        )}

        <ConfirmDialog
          open={!!confirmTarget}
          title="Accept this vendor?"
          description="They will be assigned to your job. Other pending requests will be automatically rejected."
          confirmLabel="Yes, Assign"
          isPending={assignMutation.isPending}
          onConfirm={() => confirmTarget && assignMutation.mutate(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
        />
      </div>
    </AuthGuard>
  );
}
