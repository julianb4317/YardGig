"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJobDetail } from "@/lib/api/jobs";
import { apiClient, ApiError } from "@/lib/api-client";
import { JOB_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { CategoryDetailsFields, type JobDetails } from "@/components/jobs/category-details-fields";
import { useEffect, useState } from "react";

const editJobSchema = z.object({
  title: z.string().min(3, "Title required (min 3 chars)").max(200),
  description: z.string().min(10, "Describe the work (min 10 chars)").max(5000),
  categories: z.array(z.string()).min(1, "Select at least one category").max(5),
  budgetDollars: z.number().min(1).max(10000).optional().or(z.nan().transform(() => undefined)),
  hourlyRate: z.number().min(5).optional().or(z.nan().transform(() => undefined)),
  estimatedHours: z.number().min(0.5).optional().or(z.nan().transform(() => undefined)),
  maxHours: z.number().min(0.5).optional().or(z.nan().transform(() => undefined)),
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.scheduleStart && data.scheduleEnd) {
    if (new Date(data.scheduleEnd) < new Date(data.scheduleStart)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date must be after start date", path: ["scheduleEnd"] });
    }
  }
});

type EditJobForm = z.infer<typeof editJobSchema>;

export default function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [jobDetails, setJobDetails] = useState<JobDetails>({});

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJobDetail(id),
    enabled: !!id,
  });

  const isHourly = job?.pricingType === "hourly";

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EditJobForm>({
    resolver: zodResolver(editJobSchema),
    defaultValues: { categories: [] },
  });

  // Pre-fill form when job data loads
  useEffect(() => {
    if (job) {
      setValue("title", job.title);
      setValue("description", job.description);
      setValue("categories", job.categories);
      if (job.pricingType === "hourly") {
        setValue("hourlyRate", (job.hourlyRateCents ?? 0) / 100);
        setValue("estimatedHours", job.estimatedHours ?? undefined);
        setValue("maxHours", job.maxHours ?? undefined);
      } else {
        setValue("budgetDollars", job.budgetCents / 100);
      }
      if (job.scheduleStart) setValue("scheduleStart", job.scheduleStart.slice(0, 16));
      if (job.scheduleEnd) setValue("scheduleEnd", job.scheduleEnd.slice(0, 16));
      if (job.jobDetailsJson) {
        try { setJobDetails(JSON.parse(job.jobDetailsJson)); } catch {}
      }
    }
  }, [job, setValue]);

  const selectedCategories = watch("categories");

  const toggleCategory = (cat: string) => {
    const current = selectedCategories ?? [];
    const updated = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    setValue("categories", updated, { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: (data: EditJobForm) => {
      const budgetCents = isHourly
        ? Math.round((data.hourlyRate ?? 0) * (data.maxHours ?? 0) * 100)
        : Math.round((data.budgetDollars ?? 0) * 100);

      return apiClient<{ success: boolean; budgetChanged?: boolean; oldBudgetCents?: number; newBudgetCents?: number }>(`/api/jobs/${id}`, {
        method: "PUT",
        body: {
          title: data.title,
          description: data.description,
          categories: data.categories,
          budgetCents,
          scheduleStart: data.scheduleStart || undefined,
          scheduleEnd: data.scheduleEnd || undefined,
          jobDetailsJson: Object.keys(jobDetails).length > 0 ? JSON.stringify(jobDetails) : undefined,
          hourlyRateCents: isHourly ? Math.round((data.hourlyRate ?? 0) * 100) : undefined,
          estimatedHours: isHourly ? data.estimatedHours : undefined,
          maxHours: isHourly ? data.maxHours : undefined,
        },
      });
    },
    onSuccess: (result) => {
      if (result.budgetChanged) {
        toast.success(`Job updated! Budget changed. Payment hold updated.`);
      } else {
        toast.success("Job updated!");
      }
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      router.push(`/jobs/${id}`);
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to update job.");
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError || !job) {
    return (
      <AuthGuard requiredRole="Customer">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <ErrorState title="Job not found" message="This job may have been removed." />
        </div>
      </AuthGuard>
    );
  }

  if (job.status !== "Open") {
    return (
      <AuthGuard requiredRole="Customer">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <ErrorState title="Cannot edit" message="Jobs can only be edited while in Open status." />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requiredRole="Customer">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button onClick={() => router.push(`/jobs/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Job
        </button>

        <h1 className="text-2xl font-bold">Edit Job</h1>
        <p className="mt-1 text-sm text-gray-500">Update your job details. If you change the budget, your payment hold will be updated.</p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="mt-8 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Job Title</label>
            <input
              {...register("title")}
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

          {/* Category-specific details */}
          {selectedCategories && selectedCategories.length > 0 && (
            <CategoryDetailsFields
              categories={selectedCategories}
              value={jobDetails}
              onChange={setJobDetails}
            />
          )}

          {/* Pricing - Fixed */}
          {!isHourly && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Budget ($)</label>
              <input
                {...register("budgetDollars", { valueAsNumber: true })}
                type="number"
                min={1}
                max={10000}
                step={1}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {errors.budgetDollars && <p className="mt-1 text-xs text-red-600">{errors.budgetDollars.message}</p>}
              <p className="mt-1 text-xs text-gray-400">If you change the budget, your payment authorization will be updated.</p>
            </div>
          )}

          {/* Pricing - Hourly */}
          {isHourly && (
            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">⏱ Hourly Pricing</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hourly Rate ($)</label>
                  <input
                    {...register("hourlyRate", { valueAsNumber: true })}
                    type="number"
                    min={5}
                    step={1}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estimated Hours</label>
                  <input
                    {...register("estimatedHours", { valueAsNumber: true })}
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Hours</label>
                  <input
                    {...register("maxHours", { valueAsNumber: true })}
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">Changing the rate or max hours will update your payment authorization.</p>
            </div>
          )}

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

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Save Changes
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
