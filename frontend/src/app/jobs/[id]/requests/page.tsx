"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, MapPin, DollarSign, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VendorProfileModal } from "@/components/profiles/vendor-profile-modal";
import { fetchJobRequests, assignVendor, fetchJobDetail } from "@/lib/api/jobs";
import type { AssignVendorResponse } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api-client";
import type { VendorRequestDto } from "@/lib/types";
import { formatCents } from "@/lib/utils";

function VendorRequestCard({
  req,
  jobBudgetCents,
  onAccept,
  isAssigning,
}: {
  req: VendorRequestDto;
  jobBudgetCents: number;
  onAccept: (vendorRequestId: string) => void;
  isAssigning: boolean;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const distanceMiles = req.distanceMeters ? (req.distanceMeters / 1609.34).toFixed(1) : null;
  const isHigherPrice = req.proposedPriceCents != null && req.proposedPriceCents > jobBudgetCents;

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
          {req.insuranceVerified && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5" title="Insurance Verified">
              <ShieldCheck className="h-3 w-3" /> Insured
            </span>
          )}
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
          <span className={`flex items-center gap-1 font-medium ${isHigherPrice ? "text-amber-700" : "text-gray-700"}`}>
            <DollarSign className="h-3.5 w-3.5" /> {formatCents(req.proposedPriceCents)}
            {isHigherPrice && (
              <span className="text-xs text-amber-600 ml-1">(+{formatCents(req.proposedPriceCents - jobBudgetCents)})</span>
            )}
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

  // Standard assignment confirmation
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  // Price difference confirmation
  const [priceConfirm, setPriceConfirm] = useState<{
    vendorRequestId: string;
    originalBudgetCents: number;
    vendorPriceCents: number;
    differenceCents: number;
  } | null>(null);

  const { data: job } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJobDetail(id),
    enabled: !!id,
  });

  const { data: requests, isLoading, isError, refetch } = useQuery({
    queryKey: ["jobRequests", id],
    queryFn: () => fetchJobRequests(id),
    enabled: !!id,
  });

  const assignMutation = useMutation({
    mutationFn: (params: { vendorRequestId: string; confirmedPriceCents?: number }) =>
      assignVendor(id, params.vendorRequestId, params.confirmedPriceCents),
    onSuccess: (data: AssignVendorResponse, variables: { vendorRequestId: string; confirmedPriceCents?: number }) => {
      // If the backend says we need price confirmation, show the price modal
      if (data.requiresPriceConfirmation) {
        setConfirmTarget(null);
        setPriceConfirm({
          vendorRequestId: variables.vendorRequestId,
          originalBudgetCents: data.originalBudgetCents!,
          vendorPriceCents: data.vendorPriceCents!,
          differenceCents: data.differenceCents!,
        });
        return;
      }

      // Assignment succeeded
      toast.success("Vendor assigned! They've been notified.");
      setConfirmTarget(null);
      setPriceConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["jobRequests", id] });
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      router.push(`/jobs/${id}`);
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to assign vendor.");
      setConfirmTarget(null);
      setPriceConfirm(null);
    },
  });

  const handleAcceptVendor = (vendorRequestId: string) => {
    // Check if this vendor has a higher proposed price
    const req = requests?.find((r: VendorRequestDto) => r.vendorRequestId === vendorRequestId);
    if (req?.proposedPriceCents && job?.budgetCents && req.proposedPriceCents > job.budgetCents) {
      // Show price confirmation directly (we already know the price difference)
      setPriceConfirm({
        vendorRequestId,
        originalBudgetCents: job.budgetCents,
        vendorPriceCents: req.proposedPriceCents,
        differenceCents: req.proposedPriceCents - job.budgetCents,
      });
    } else {
      // Normal flow — show standard confirm
      setConfirmTarget(vendorRequestId);
    }
  };

  const handleConfirmAssign = () => {
    if (confirmTarget) {
      assignMutation.mutate({ vendorRequestId: confirmTarget });
    }
  };

  const handleConfirmPriceDifference = () => {
    if (priceConfirm) {
      assignMutation.mutate({
        vendorRequestId: priceConfirm.vendorRequestId,
        confirmedPriceCents: priceConfirm.vendorPriceCents,
      });
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <AuthGuard requiredRole="Customer">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button onClick={() => router.push(`/jobs/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Job
        </button>

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
                jobBudgetCents={job?.budgetCents ?? 0}
                onAccept={handleAcceptVendor}
                isAssigning={assignMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Standard assignment confirmation (no price difference) */}
        <ConfirmDialog
          open={!!confirmTarget}
          title="Accept this vendor?"
          description={
            job?.pricingType === "hourly"
              ? "They will be assigned to your job. Your authorization hold remains in place — you will NOT be charged until you review and approve the actual hours worked after completion."
              : "They will be assigned to your job. Your authorization hold remains in place — you will NOT be charged until you verify the completed work."
          }
          confirmLabel="Assign Vendor"
          isPending={assignMutation.isPending}
          onConfirm={handleConfirmAssign}
          onCancel={() => setConfirmTarget(null)}
        />

        {/* Price difference confirmation modal */}
        {priceConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPriceConfirm(null)}>
            <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Additional Charge Required</h3>
              </div>

              <p className="mt-3 text-sm text-gray-600">
                This vendor's price is higher than your original budget. The difference will be charged to your card now and added to escrow.
              </p>

              <div className="mt-4 rounded-lg bg-gray-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Your budget (already escrowed)</span>
                  <span className="font-medium">{formatCents(priceConfirm.originalBudgetCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Vendor's price</span>
                  <span className="font-medium">{formatCents(priceConfirm.vendorPriceCents)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-amber-700">Additional charge now</span>
                  <span className="text-amber-700">{formatCents(priceConfirm.differenceCents)}</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Total escrowed: {formatCents(priceConfirm.vendorPriceCents)}. Released to vendor when you verify completion.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setPriceConfirm(null)}
                  disabled={assignMutation.isPending}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPriceDifference}
                  disabled={assignMutation.isPending}
                  className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {assignMutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
                  Confirm & Pay {formatCents(priceConfirm.differenceCents)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
