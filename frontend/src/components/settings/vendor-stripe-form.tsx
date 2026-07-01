"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { fetchVendorProfile } from "@/lib/api/profiles";
import { Spinner } from "@/components/ui/spinner";

export function VendorStripeForm() {
  const { data: profile, isLoading } = useQuery({ queryKey: ["vendorProfile"], queryFn: fetchVendorProfile });

  if (isLoading) return <Spinner className="mx-auto" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payouts & Banking</h2>
        {profile?.stripeOnboarded ? (
          <span className="flex items-center gap-1 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <CheckCircle className="h-4 w-4" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <AlertTriangle className="h-4 w-4" /> Not Set Up
          </span>
        )}
      </div>

      {profile?.stripeOnboarded ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">Bank account connected</p>
              <p className="mt-1 text-xs text-green-600">
                Your payouts are automatically transferred to your bank account on a weekly basis.
              </p>
              <button className="mt-2 flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800">
                <ExternalLink className="h-3 w-3" /> Open Stripe Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Set up your bank account to receive payouts</p>
              <p className="mt-1 text-xs text-amber-600">
                Connect your bank account through Stripe to receive payments for completed jobs.
                This is required before you can get paid.
              </p>
              <button className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Connect Bank Account
              </button>
              <p className="mt-2 text-xs text-gray-400">
                Stripe integration coming soon. In development mode, payouts are simulated.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
