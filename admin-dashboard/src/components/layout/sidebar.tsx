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

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    label: "Users",
    icon: <Users className="h-5 w-5" />,
    children: [
      { label: "All Users", href: "/users" },
      { label: "Verification", href: "/verification" },
    ],
  },
  { label: "Disputes", href: "/disputes", icon: <AlertTriangle className="h-5 w-5" /> },
  { label: "Jobs", href: "/jobs", icon: <Briefcase className="h-5 w-5" /> },
  {
    label: "Finance",
    icon: <DollarSign className="h-5 w-5" />,
    children: [
      { label: "Revenue", href: "/finance" },
      { label: "Payouts", href: "/finance/payouts" },
      { label: "Commissions", href: "/finance/commissions" },
    ],
  },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Audit Log", href: "/audit", icon: <ScrollText className="h-5 w-5" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
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
        {navigation.map((item) => {
          if (item.children) {
            const isOpen = expanded[item.label] ?? false;
            const hasActiveChild = item.children.some((c) => isActive(c.href));

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
                    {item.children.map((child) => (
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
