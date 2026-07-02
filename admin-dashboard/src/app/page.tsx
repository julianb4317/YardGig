"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { formatCents } from "@/lib/utils";
import {
  Briefcase,
  Users,
  AlertTriangle,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";

interface DashboardData {
  jobsToday: number;
  activeVendors: number;
  openDisputes: number;
  pendingVerifications: number;
  revenueTodayCents: number;
  revenueMtdCents: number;
}

interface Payout {
  id: string;
  status: string;
}

interface DisputeRow {
  id: string;
  status: string;
  createdAt: string;
}

const kpiConfig = [
  { key: "jobsToday" as const, label: "Jobs Today", icon: Briefcase, color: "bg-blue-50 text-blue-600" },
  { key: "activeVendors" as const, label: "Active Vendors", icon: Users, color: "bg-green-50 text-green-600" },
  { key: "openDisputes" as const, label: "Open Disputes", icon: AlertTriangle, color: "bg-amber-50 text-amber-600" },
  { key: "pendingVerifications" as const, label: "Pending Verifications", icon: ShieldCheck, color: "bg-purple-50 text-purple-600" },
  { key: "revenueTodayCents" as const, label: "Revenue Today", icon: DollarSign, color: "bg-emerald-50 text-emerald-600", isCurrency: true },
  { key: "revenueMtdCents" as const, label: "Revenue MTD", icon: TrendingUp, color: "bg-indigo-50 text-indigo-600", isCurrency: true },
];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiClient<DashboardData>("/api/admin/dashboard"),
  });

  const { data: payouts } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () => apiClient<Payout[]>("/api/admin/finance/payouts"),
    refetchOnWindowFocus: false,
  });

  const { data: disputes } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => apiClient<DisputeRow[]>("/api/admin/disputes"),
    refetchOnWindowFocus: false,
  });

  const failedPayouts = payouts?.filter((p) => p.status === "Failed").length ?? 0;
  const agingDisputes = disputes?.filter((d) => {
    if (d.status === "Resolved" || d.status === "Closed") return false;
    const ageHours = (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60);
    return ageHours > 24;
  }).length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {kpiConfig.map((kpi) => {
          const Icon = kpi.icon;
          const value = data?.[kpi.key] ?? 0;
          const display = kpi.isCurrency ? formatCents(value) : value.toLocaleString();

          return (
            <div
              key={kpi.key}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-3 ${kpi.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{display}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerts Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Alerts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-xl border p-4 ${failedPayouts > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${failedPayouts > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Failed Payouts</p>
                <p className={`text-xl font-bold ${failedPayouts > 0 ? "text-red-700" : "text-gray-900"}`}>
                  {failedPayouts}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${agingDisputes > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${agingDisputes > 0 ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"}`}>
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Disputes &gt; 24h</p>
                <p className={`text-xl font-bold ${agingDisputes > 0 ? "text-amber-700" : "text-gray-900"}`}>
                  {agingDisputes}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-gray-100 text-gray-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Expiring Insurance</p>
                <p className="text-xs text-gray-400 mt-0.5">Requires backend support</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
