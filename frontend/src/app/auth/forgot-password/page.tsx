"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";

const schema = z.object({ email: z.string().email("Valid email required") });
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: Form) =>
      apiClient("/api/auth/forgot-password", { method: "POST", body: data, skipAuth: true }),
    onSuccess: () => {
      toast.success("If that email exists, a reset link has been sent.");
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Request failed.");
    },
  });

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-center">Reset Password</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Enter your email and we'll send reset instructions.
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

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
          Send Reset Link
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link href="/auth/login" className="text-gray-500 hover:text-gray-700">Back to sign in</Link>
      </p>
    </div>
  );
}
