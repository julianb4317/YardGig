"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Briefcase,
  DollarSign,
  BarChart3,
  ScrollText,
  Settings,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasRole } from "@/lib/auth";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  roles: string[]; // Which roles can see this item
  children?: { label: string; href: string; roles: string[] }[];
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["Owner", "Admin", "Finance", "Support", "Marketing"] },
  {
    label: "Users",
    icon: <Users className="h-5 w-5" />,
    roles: ["Owner", "Admin", "Support"],
    children: [
      { label: "All Users", href: "/users", roles: ["Owner", "Admin", "Support"] },
      { label: "Verification", href: "/verification", roles: ["Owner", "Admin", "Support"] },
      { label: "Insurance", href: "/verification/insurance", roles: ["Owner", "Admin", "Support"] },
    ],
  },
  { label: "Disputes", href: "/disputes", icon: <AlertTriangle className="h-5 w-5" />, roles: ["Owner", "Admin", "Support"] },
  { label: "Jobs", href: "/jobs", icon: <Briefcase className="h-5 w-5" />, roles: ["Owner", "Admin", "Support"] },
  {
    label: "Finance",
    icon: <DollarSign className="h-5 w-5" />,
    roles: ["Owner", "Admin", "Finance"],
    children: [
      { label: "Revenue", href: "/finance", roles: ["Owner", "Admin", "Finance"] },
      { label: "Transactions", href: "/finance/transactions", roles: ["Owner", "Admin", "Finance"] },
      { label: "Payouts", href: "/finance/payouts", roles: ["Owner", "Admin", "Finance"] },
      { label: "Commissions", href: "/finance/commissions", roles: ["Owner", "Admin", "Finance"] },
      { label: "Refunds", href: "/finance/refunds", roles: ["Owner", "Admin", "Finance", "Support"] },
      { label: "Escrow", href: "/finance/escrow", roles: ["Owner", "Admin", "Finance"] },
    ],
  },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-5 w-5" />, roles: ["Owner", "Admin", "Finance", "Marketing"] },
  { label: "Audit Log", href: "/audit", icon: <ScrollText className="h-5 w-5" />, roles: ["Owner", "Admin", "Finance"] },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, roles: ["Owner"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Users: true,
    Finance: true,
  });

  const toggleSection = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <ShieldCheck className="h-7 w-7 text-brand-400" />
        <span className="text-lg font-bold tracking-tight">Rakr Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.filter((item) => item.roles.some((r) => hasRole(r))).map((item) => {
          if (item.children) {
            const visibleChildren = item.children.filter((c) => c.roles.some((r) => hasRole(r)));
            if (visibleChildren.length === 0) return null;

            const isOpen = expanded[item.label] ?? false;
            const hasActiveChild = visibleChildren.some((c) => isActive(c.href));

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleSection(item.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                    hasActiveChild
                      ? "text-white bg-slate-800"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  )}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>
                {isOpen && (
                  <div className="ml-8 mt-1 space-y-0.5">
                    {visibleChildren.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block px-3 py-2 rounded-lg text-sm transition",
                          isActive(child.href)
                            ? "text-white bg-brand-600/20 font-medium"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                isActive(item.href!)
                  ? "text-white bg-brand-600/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">Rakr Admin v1.0</p>
      </div>
    </aside>
  );
}
