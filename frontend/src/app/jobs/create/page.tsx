"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Spinner } from "@/components/ui/spinner";
import { createJob } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api-client";
import { JOB_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";

const createJobSchema = z.object({
  title: z.string().min(3, "Title required (min 3 chars)").max(200),
  description: z.string().min(10, "Describe the work (min 10 chars)").max(5000),
  categories: z.array(z.string()).min(1, "Select at least one category").max(5),
  address: z.string().min(5, "Full address required"),
  budgetDollars: z.number({ invalid_type_error: "Enter a budget" }).min(1, "Min $1").max(10000, "Max $10,000"),
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
});

type CreateJobForm = z.infer<typeof createJobSchema>;

export default function CreateJobPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateJobForm>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { categories: [] },
  });

  const selectedCategories = watch("categories");

  const toggleCategory = (cat: string) => {
    const current = selectedCategories ?? [];
    const updated = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    setValue("categories", updated, { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: (data: CreateJobForm) =>
      createJob({
        title: data.title,
        description: data.description,
        categories: data.categories,
        address: data.address,
        budgetCents: Math.round(data.budgetDollars * 100),
        scheduleStart: data.scheduleStart || undefined,
        scheduleEnd: data.scheduleEnd || undefined,
      }),
    onSuccess: (result) => {
      toast.success("Job posted! Vendors will see it on the map.");
      router.push(`/jobs/${result.id}`);
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to create job.");
    },
  });

  return (
    <AuthGuard requiredRole="Customer">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Post a Yard Work Job</h1>
        <p className="mt-1 text-sm text-gray-500">Describe what you need done and set your budget.</p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="mt-8 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Job Title</label>
            <input
              {...register("title")}
              placeholder="e.g., Front Yard Mowing"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              {...register("description")}
              rows={4}
              placeholder="What needs to be done? Any special instructions?"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
            <div className="flex flex-wrap gap-2">
              {JOB_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition ${
                    selectedCategories?.includes(cat)
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            {errors.categories && <p className="mt-1 text-xs text-red-600">{errors.categories.message}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input
              {...register("address")}
              placeholder="Full street address"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
            <p className="mt-1 text-xs text-gray-400">Exact address shared only after vendor assignment.</p>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Budget ($)</label>
            <input
              {...register("budgetDollars", { valueAsNumber: true })}
              type="number"
              min={1}
              max={10000}
              step={1}
              placeholder="50"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {errors.budgetDollars && <p className="mt-1 text-xs text-red-600">{errors.budgetDollars.message}</p>}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Earliest Start</label>
              <input
                {...register("scheduleStart")}
                type="datetime-local"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Latest End</label>
              <input
                {...register("scheduleEnd")}
                type="datetime-local"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Escrow notice */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">💳 Payment held in escrow</p>
            <p className="mt-1 text-xs text-blue-600">
              Your card on file will be charged the budget amount when you post this job. 
              Funds are held securely in escrow until you verify the work is completed. 
              You won't be charged again — the escrowed amount is released to the vendor only after your approval.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Post Job & Hold Payment
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
