"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Clock, CreditCard } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClient } from "@/lib/api-client";
import { formatCents } from "@/lib/utils";

interface VendorBalance {
  availableBalanceCents: number;
  pendingBalanceCents: number;
  lifetimeEarnedCents: number;
  lastPayoutAt: string | null;
}

interface VendorMyRequest {
  vendorRequestId: string;
  jobId: string;
  jobTitle: string;
  budgetCents: number;
  status: string;
  jobStatus: string;
  proposedPriceCents: number | null;
  createdAt: string;
}

export default function VendorEarningsPage() {
  const { data: balance, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ["vendorBalance"],
    queryFn: () => apiClient<VendorBalance>("/api/payments/vendor/balance"),
  });

  const { data: requests } = useQuery({
    queryKey: ["vendorMyRequests"],
    queryFn: () => apiClient<VendorMyRequest[]>("/api/jobs/vendor/my-requests"),
  });

  // Calculate category breakdown from completed jobs
  const completedJobs = requests?.filter((r) => r.status === "Accepted" && ["Paid", "Completed", "Closed"].includes(r.jobStatus)) ?? [];
  const totalEarnedFromJobs = completedJobs.reduce((sum, j) => sum + Math.round(j.budgetCents * 0.85), 0); // 85% after platform fee

  // Group earnings by job for breakdown
  const jobBreakdown = completedJobs.map((j) => ({
    title: j.jobTitle,
    budgetCents: j.budgetCents,
    earnedCents: Math.round(j.budgetCents * 0.85),
    date: j.createdAt,
  }));

  if (balanceLoading) return <PageLoader />;

  return (
    <AuthGuard requiredRole="Vendor">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">My Earnings</h1>
        <p className="mt-1 text-sm text-gray-500">Track your balance, completed jobs, and upcoming payouts.</p>

        {balanceError && <ErrorState message="Failed to load earnings." onRetry={() => refetchBalance()} />}

        {balance && (
          <>
            {/* Balance Cards */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                <div className="flex items-center gap-2 text-emerald-600">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Available Balance</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {formatCents(balance.availableBalanceCents)}
                </p>
                <p className="mt-1 text-xs text-gray-500">Paid out weekly</p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
                <div className="flex items-center gap-2 text-blue-600">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-medium">Lifetime Earned</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {formatCents(balance.lifetimeEarnedCents)}
                </p>
                <p className="mt-1 text-xs text-gray-500">Total after fees</p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5">
                <div className="flex items-center gap-2 text-purple-600">
                  <Clock className="h-5 w-5" />
                  <span className="text-sm font-medium">Last Payout</span>
                </div>
                <p className="mt-2 text-lg font-bold text-gray-900">
                  {balance.lastPayoutAt ? new Date(balance.lastPayoutAt).toLocaleDateString() : "None yet"}
                </p>
                <p className="mt-1 text-xs text-gray-500">Payouts processed weekly</p>
              </div>
            </div>

            {/* How it works */}
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">How payouts work</p>
                  <p className="mt-1 text-xs text-gray-500">
                    When a customer verifies your work, 85% of the job budget is added to your available balance (15% platform fee).
                    Payouts are processed weekly to your bank account on file.
                  </p>
                </div>
              </div>
            </div>

            {/* Job Earnings Breakdown */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">Completed Jobs</h2>

              {jobBreakdown.length === 0 ? (
                <EmptyState
                  title="No completed jobs yet"
                  message="Complete your first job and get verified by the customer to see earnings here."
                />
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Job</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Budget</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Your Earnings</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {jobBreakdown.map((job, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{job.title}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{formatCents(job.budgetCents)}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCents(job.earnedCents)}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{new Date(job.date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {formatCents(completedJobs.reduce((s, j) => s + j.budgetCents, 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {formatCents(totalEarnedFromJobs)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
