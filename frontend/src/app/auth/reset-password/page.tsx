"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";

const schema = z.object({
  email: z.string().email("Valid email required"),
  token: z.string().min(1, "Reset token required"),
  newPassword: z.string().min(12, "At least 12 characters"),
});

type Form = z.infer<typeof schema>;

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: searchParams.get("email") ?? "",
      token: searchParams.get("token") ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Form) =>
      apiClient("/api/auth/reset-password", { method: "POST", body: data, skipAuth: true }),
    onSuccess: () => {
      toast.success("Password reset successful. You can now sign in.");
      router.push("/auth/login");
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Reset failed. Token may have expired.");
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          {...register("email")}
          type="email"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Reset Token</label>
        <input
          {...register("token")}
          type="text"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {errors.token && <p className="mt-1 text-xs text-red-600">{errors.token.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">New Password</label>
        <input
          {...register("newPassword")}
          type="password"
          autoComplete="new-password"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
        Reset Password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-center">Set New Password</h1>
      <Suspense fallback={<div className="mt-8 text-center text-sm text-gray-400">Loading...</div>}>
        <ResetForm />
      </Suspense>
      <p className="mt-4 text-center text-sm">
        <Link href="/auth/login" className="text-gray-500 hover:text-gray-700">Back to sign in</Link>
      </p>
    </div>
  );
}
