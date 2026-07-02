"use client";

import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="rounded-full bg-indigo-50 p-6 mb-4">
        <BarChart3 className="h-12 w-12 text-indigo-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics</h2>
      <p className="text-gray-500 max-w-md">
        Charts, trends, and growth metrics are coming soon. This section will include user
        growth, job volume trends, revenue charts, and vendor performance analytics.
      </p>
      <span className="mt-4 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-600">
        Coming Soon
      </span>
    </div>
  );
}
