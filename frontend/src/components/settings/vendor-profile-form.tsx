"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { fetchVendorProfile, updateVendorProfile } from "@/lib/api/profiles";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { ApiError } from "@/lib/api-client";
import { JOB_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";

const schema = z.object({
  businessName: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  serviceCategories: z.array(z.string()).min(1, "Select at least one service"),
  serviceRadiusMiles: z.number().min(1).max(100),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function VendorProfileForm() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: fetchVendorProfile,
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedCategories = watch("serviceCategories") ?? [];

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      reset({
        businessName: profile.businessName ?? "",
        bio: profile.bio ?? "",
        serviceCategories: profile.serviceCategories,
        serviceRadiusMiles: profile.serviceRadiusMiles,
        address: "",
      });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => updateVendorProfile({
      businessName: data.businessName || undefined,
      bio: data.bio || undefined,
      serviceCategories: data.serviceCategories,
      serviceRadiusMiles: data.serviceRadiusMiles,
      address: data.address || undefined,
    }),
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Update failed."),
  });

  const toggleCategory = (cat: string) => {
    const updated = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    setValue("serviceCategories", updated, { shouldValidate: true, shouldDirty: true });
  };

  if (isLoading) return <Spinner className="mx-auto" />;
  if (isError) return <ErrorState message="Failed to load profile." onRetry={() => refetch()} />;

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
      {profile?.verificationStatus && (
        <div className={`rounded-md px-3 py-2 text-sm ${
          profile.verificationStatus === "Approved" ? "bg-green-50 text-green-700" :
          profile.verificationStatus === "Pending" ? "bg-yellow-50 text-yellow-700" :
          "bg-red-50 text-red-700"
        }`}>
          Status: <strong>{profile.verificationStatus}</strong>
          {profile.verificationStatus === "Pending" && " — Under review by admin"}
        </div>
      )}

      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">Business Name</label>
        <input id="businessName" {...register("businessName")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Bio</label>
        <textarea id="bio" {...register("bio")} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Services Offered</label>
        <div className="flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium border transition ${
                selectedCategories.includes(cat)
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
              aria-pressed={selectedCategories.includes(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        {errors.serviceCategories && <p className="mt-1 text-xs text-red-600">{errors.serviceCategories.message}</p>}
      </div>

      <div>
        <label htmlFor="serviceRadiusMiles" className="block text-sm font-medium text-gray-700">Service Radius (miles)</label>
        <input id="serviceRadiusMiles" type="number" {...register("serviceRadiusMiles", { valueAsNumber: true })} min={1} max={100} className="mt-1 block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        {errors.serviceRadiusMiles && <p className="mt-1 text-xs text-red-600">{errors.serviceRadiusMiles.message}</p>}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">Home Address (for job radius)</label>
        <input id="address" {...register("address")} placeholder="Leave blank to keep current" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        <p className="mt-1 text-xs text-gray-400">Only used to show jobs near you. Not shared publicly.</p>
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
