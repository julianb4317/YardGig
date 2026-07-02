"use client";

import { usePathname } from "next/navigation";
import { Search, LogOut, User } from "lucide-react";
import { logout } from "@/lib/auth";
import { useState } from "react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/verification": "Vendor Verification",
  "/disputes": "Disputes",
  "/jobs": "Jobs",
  "/finance": "Finance",
  "/finance/payouts": "Payouts",
  "/finance/commissions": "Commissions",
  "/analytics": "Analytics",
  "/audit": "Audit Log",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const title = pageTitles[pathname] ?? "Admin";

  const handleLogout = async () => {
    await logout();
    window.location.href = "/auth/login";
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-9 pr-4 py-2 w-64 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* User avatar + logout */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
