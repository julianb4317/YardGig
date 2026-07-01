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

const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(12, "At least 12 characters"),
  confirmPassword: z.string(),
  displayName: z.string().min(2, "Name required").max(100),
  roles: z.array(z.string()).min(1, "Select at least one role"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { roles: ["Customer"] },
  });

  const selectedRoles = watch("roles");
  const passwordValue = watch("password");

  const toggleRole = (role: string) => {
    const current = selectedRoles ?? [];
    const updated = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    setValue("roles", updated, { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) => {
      const { confirmPassword, ...payload } = data;
      return apiClient<any>("/api/auth/register", { method: "POST", body: payload, skipAuth: true });
    },
    onSuccess: (data) => {
      if (data.accessToken) {
        // Registration returned tokens — go directly to dashboard
        setAuth(data);
        toast.success("Account created! Welcome to Rakr.");
        const roles: string[] = data.roles ?? [];
        if (roles.includes("Customer")) router.push("/settings?setup=true");
        else if (roles.includes("Vendor")) router.push("/settings?setup=true");
        else router.push("/");
      } else {
        // Fallback: email verification required
        toast.success("Account created! Check your email to verify.");
        router.push("/auth/login");
      }
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Registration failed.");
    },
  });

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-center">Create Account</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-brand-600 hover:underline">Sign in</Link>
      </p>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input
            {...register("displayName")}
            type="text"
            autoComplete="name"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName.message}</p>}
        </div>

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
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          <p className="mt-1 text-xs text-gray-400">Min 12 chars, uppercase, lowercase, digit, special character.</p>
        </div>

        {passwordValue && passwordValue.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              {...register("confirmPassword")}
              type="password"
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">I want to…</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => toggleRole("Customer")}
              className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${
                selectedRoles?.includes("Customer")
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              🏡 Hire for yard work
            </button>
            <button
              type="button"
              onClick={() => toggleRole("Vendor")}
              className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${
                selectedRoles?.includes("Vendor")
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              🌿 Provide services
            </button>
          </div>
          {errors.roles && <p className="mt-1 text-xs text-red-600">{errors.roles.message}</p>}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
          Create Account
        </button>
      </form>
    </div>
  );
}
