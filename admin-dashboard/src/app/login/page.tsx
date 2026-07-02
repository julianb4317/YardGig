"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { setAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const data = await apiClient<{
        accessToken: string;
        refreshToken: string;
        expiresAt: string;
        userId: string;
        roles: string[];
      }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuth: true,
      });

      // Check if user has admin access
      const adminRoles = ["Admin", "Owner", "Finance", "Support", "Marketing"];
      const hasAdminAccess = data.roles.some((r) => adminRoles.includes(r));

      if (!hasAdminAccess) {
        toast.error("Access denied. You don't have admin privileges.");
        setIsPending(false);
        return;
      }

      setAuth(data);
      toast.success("Welcome to Rakr Admin.");
      router.push("/");
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.errors?.[0] ?? "Login failed.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <ShieldCheck className="h-12 w-12 text-brand-400 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-white">Rakr Admin</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to the administration panel</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
