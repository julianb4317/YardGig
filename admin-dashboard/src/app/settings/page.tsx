"use client";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="rounded-full bg-gray-100 p-6 mb-4">
        <Settings className="h-12 w-12 text-gray-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Settings</h2>
      <p className="text-gray-500 max-w-md">
        Platform configuration, feature flags, rate limits, and system settings will be
        available here in a future release.
      </p>
      <span className="mt-4 rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-600">
        Coming Soon
      </span>
    </div>
  );
}
