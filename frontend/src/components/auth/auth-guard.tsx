"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, hasRole } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }
    if (requiredRole && !hasRole(requiredRole)) {
      router.replace("/unauthorized");
    }
  }, [router, requiredRole]);

  if (!isAuthenticated()) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
