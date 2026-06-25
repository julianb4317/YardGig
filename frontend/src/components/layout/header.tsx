"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { isAuthenticated, getUser, logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const authenticated = isAuthenticated();
  const user = getUser();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const navLinks = authenticated
    ? [
        ...(user?.roles.includes("Customer")
          ? [{ href: "/dashboard/customer", label: "My Jobs" }]
          : []),
        ...(user?.roles.includes("Vendor")
          ? [
              { href: "/dashboard/vendor", label: "Find Jobs" },
              { href: "/dashboard/vendor/requests", label: "My Requests" },
            ]
          : []),
        ...(user?.roles.includes("Admin") || user?.roles.includes("Owner")
          ? [{ href: "/admin", label: "Admin" }]
          : []),
      ]
    : [];

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-brand-600">
          YardGig
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition",
                pathname.startsWith(link.href) ? "text-brand-600" : "text-gray-600 hover:text-gray-900"
              )}
            >
              {link.label}
            </Link>
          ))}
          {authenticated ? (
            <>
              <NotificationBell />
              <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile menu button */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t px-4 py-3 md:hidden space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-sm font-medium text-gray-700"
            >
              {link.label}
            </Link>
          ))}
          {authenticated ? (
            <button onClick={handleLogout} className="block py-2 text-sm text-red-600">
              Logout
            </button>
          ) : (
            <Link href="/auth/login" className="block py-2 text-sm font-medium text-brand-600">
              Sign In
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
