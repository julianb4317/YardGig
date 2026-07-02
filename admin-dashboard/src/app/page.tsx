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
} from "lucide-react";

interface DashboardData {
  jobsToday: number;
  activeVendors: number;
  openDisputes: number;
  pendingVerifications: number;
  revenueTodayCents: number;
  revenueMtdCents: number;
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
    </div>
  );
}
