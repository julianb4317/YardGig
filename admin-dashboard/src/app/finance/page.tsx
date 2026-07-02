"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { formatCents } from "@/lib/utils";
import { useState } from "react";
import { DollarSign, TrendingUp, ArrowUpRight, Briefcase } from "lucide-react";

interface RevenueData {
  grossRevenueCents: number;
  platformFeesCents: number;
  payoutsCents: number;
  jobCount: number;
}

export default function FinancePage() {
  const [period, setPeriod] = useState<string>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance-revenue", period],
    queryFn: () => apiClient<RevenueData>(`/api/admin/finance/revenue?period=${period}`),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Revenue</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <RevenueCard
          label="Gross Revenue"
          value={formatCents(data?.grossRevenueCents ?? 0)}
          icon={DollarSign}
          color="bg-emerald-50 text-emerald-600"
        />
        <RevenueCard
          label="Platform Fees"
          value={formatCents(data?.platformFeesCents ?? 0)}
          icon={TrendingUp}
          color="bg-blue-50 text-blue-600"
        />
        <RevenueCard
          label="Payouts"
          value={formatCents(data?.payoutsCents ?? 0)}
          icon={ArrowUpRight}
          color="bg-purple-50 text-purple-600"
        />
        <RevenueCard
          label="Job Count"
          value={String(data?.jobCount ?? 0)}
          icon={Briefcase}
          color="bg-amber-50 text-amber-600"
        />
      </div>
    </div>
  );
}

function RevenueCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
