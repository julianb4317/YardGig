"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { fetchCustomerProfile, updateCustomerProfile } from "@/lib/api/profiles";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { ApiError } from "@/lib/api-client";
import { CheckCircle, XCircle } from "lucide-react";

const schema = z.object({
  defaultAddress: z.string().min(5, "Enter a valid address").max(500),
});

type FormData = z.infer<typeof schema>;

export function CustomerProfileForm() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["customerProfile"],
    queryFn: fetchCustomerProfile,
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (profile) {
      reset({ defaultAddress: profile.defaultAddress ?? "" });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => updateCustomerProfile({ defaultAddress: data.defaultAddress }),
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["customerProfile"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Update failed."),
  });

  if (isLoading) return <Spinner className="mx-auto" />;
  if (isError) return <ErrorState message="Failed to load profile." onRetry={() => refetch()} />;

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        {profile?.hasPaymentMethod ? (
          <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /> Payment method on file</span>
        ) : (
          <span className="flex items-center gap-1 text-amber-600"><XCircle className="h-4 w-4" /> No payment method — add one before paying for jobs</span>
        )}
      </div>

      <div>
        <label htmlFor="defaultAddress" className="block text-sm font-medium text-gray-700">Default Address</label>
        <input
          id="defaultAddress"
          {...register("defaultAddress")}
          placeholder="Your home address (used to pre-fill new jobs)"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {errors.defaultAddress && <p className="mt-1 text-xs text-red-600">{errors.defaultAddress.message}</p>}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending || !isDirty}
        className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
      >
        {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
        Save Changes
      </button>
    </form>
  );
}
