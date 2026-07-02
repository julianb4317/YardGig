"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated, hasRole } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/login") {
      setChecked(true);
      return;
    }

    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    // Check admin access
    const adminRoles = ["Admin", "Owner", "Finance", "Support", "Marketing"];
    const hasAccess = adminRoles.some((r) => hasRole(r));
    if (!hasAccess) {
      router.replace("/login");
      return;
    }

    setChecked(true);
  }, [pathname, router]);

  // Login page — no shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Not checked yet — blank
  if (!checked) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
