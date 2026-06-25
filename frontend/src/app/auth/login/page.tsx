"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { setAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import type { LoginResponse } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
  mfaCode: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [requiresMfa, setRequiresMfa] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginForm) =>
      apiClient<LoginResponse>("/api/auth/login", { method: "POST", body: data, skipAuth: true }),
    onSuccess: (data) => {
      if (data.requiresMfa) {
        setRequiresMfa(true);
        toast.info("Enter your authenticator code.");
        return;
      }
      if (data.requiresEmailVerification) {
        toast.warning("Please verify your email before logging in.");
        return;
      }
      if (data.accessToken && data.refreshToken && data.userId && data.roles) {
        setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, userId: data.userId, roles: data.roles, expiresAt: data.expiresAt ?? "" });
        toast.success("Welcome back!");
        if (data.roles.includes("Vendor")) router.push("/dashboard/vendor");
        else if (data.roles.includes("Customer")) router.push("/dashboard/customer");
        else router.push("/");
      }
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Login failed.");
    },
  });

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-center">Sign In</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <Link href="/auth/register" className="text-brand-600 hover:underline">Create one</Link>
      </p>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            {...register("password")}
            type="password"
            autoComplete="current-password"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {requiresMfa && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Authenticator Code</label>
            <input
              {...register("mfaCode")}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
          Sign In
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link href="/auth/forgot-password" className="text-gray-500 hover:text-gray-700">Forgot password?</Link>
      </p>
    </div>
  );
}
