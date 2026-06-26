"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Spinner } from "@/components/ui/spinner";
import { createJob } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api-client";
import { JOB_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";

const RECURRING_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
] as const;

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const createJobSchema = z.object({
  title: z.string().min(3, "Title required (min 3 chars)").max(200),
  description: z.string().min(10, "Describe the work (min 10 chars)").max(5000),
  categories: z.array(z.string()).min(1, "Select at least one category").max(5),
  address: z.string().min(5, "Full address required"),
  budgetDollars: z.number({ invalid_type_error: "Enter a budget" }).min(1, "Min $1").max(10000, "Max $10,000"),
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.string().optional(),
  recurringDays: z.array(z.string()).optional(),
  recurringTime: z.string().optional(),
}).superRefine((data, ctx) => {
  const now = new Date();

  if (data.scheduleStart) {
    const start = new Date(data.scheduleStart);
    if (start < now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date cannot be in the past",
        path: ["scheduleStart"],
      });
    }
  }

  if (data.scheduleEnd) {
    const end = new Date(data.scheduleEnd);
    if (end < now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be in the past",
        path: ["scheduleEnd"],
      });
    }
  }

  if (data.scheduleStart && data.scheduleEnd) {
    const start = new Date(data.scheduleStart);
    const end = new Date(data.scheduleEnd);
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
        path: ["scheduleEnd"],
      });
    }
  }

  if (data.isRecurring) {
    if (!data.recurringFrequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a frequency for recurring jobs",
        path: ["recurringFrequency"],
      });
    }
    if (!data.recurringDays || data.recurringDays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one day",
        path: ["recurringDays"],
      });
    }
  }
});

type CreateJobForm = z.infer<typeof createJobSchema>;

function CreateJobFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CreateJobForm>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { categories: [], isRecurring: false, recurringDays: [] },
  });

  // Pre-fill from query params (clone job scenario)
  useEffect(() => {
    const title = searchParams.get("title");
    const description = searchParams.get("description");
    const categories = searchParams.get("categories");
    const address = searchParams.get("address");
    const budget = searchParams.get("budget");
    const recurring = searchParams.get("isRecurring");
    const frequency = searchParams.get("recurringFrequency");
    const days = searchParams.get("recurringDays");
    const time = searchParams.get("recurringTime");

    if (title) setValue("title", title);
    if (description) setValue("description", description);
    if (categories) setValue("categories", categories.split(","));
    if (address) setValue("address", address);
    if (budget) setValue("budgetDollars", Number(budget));
    if (recurring === "true") setValue("isRecurring", true);
    if (frequency) setValue("recurringFrequency", frequency);
    if (days) setValue("recurringDays", days.split(","));
    if (time) setValue("recurringTime", time);
  }, [searchParams, setValue]);

  const selectedCategories = watch("categories");
  const isRecurring = useWatch({ control, name: "isRecurring" });
  const selectedDays = watch("recurringDays") ?? [];

  const toggleCategory = (cat: string) => {
    const current = selectedCategories ?? [];
    const updated = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    setValue("categories", updated, { shouldValidate: true });
  };

  const toggleDay = (day: string) => {
    const current = selectedDays;
    const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setValue("recurringDays", updated, { shouldValidate: true });
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
        isRecurring: data.isRecurring || false,
        recurringFrequency: data.isRecurring ? data.recurringFrequency : undefined,
        recurringDays: data.isRecurring ? data.recurringDays : undefined,
        recurringTime: data.isRecurring ? data.recurringTime : undefined,
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
            {errors.scheduleStart && <p className="mt-1 text-xs text-red-600">{errors.scheduleStart.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Latest End</label>
            <input
              {...register("scheduleEnd")}
              type="datetime-local"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {errors.scheduleEnd && <p className="mt-1 text-xs text-red-600">{errors.scheduleEnd.message}</p>}
          </div>
        </div>

        {/* Recurring toggle */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("isRecurring")}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">This is a recurring job</span>
              <p className="text-xs text-gray-500">Set up a repeating schedule for regular yard work</p>
            </div>
          </label>

          {isRecurring && (
            <div className="mt-4 space-y-4 border-t pt-4">
              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">How often?</label>
                <div className="flex gap-2">
                  {RECURRING_FREQUENCIES.map((freq) => (
                    <label key={freq.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        value={freq.value}
                        {...register("recurringFrequency")}
                        className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700">{freq.label}</span>
                    </label>
                  ))}
                </div>
                {errors.recurringFrequency && <p className="mt-1 text-xs text-red-600">{errors.recurringFrequency.message}</p>}
              </div>

              {/* Days of week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Which day(s)?</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium border transition ${
                        selectedDays.includes(day)
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                {errors.recurringDays && <p className="mt-1 text-xs text-red-600">{errors.recurringDays.message}</p>}
              </div>

              {/* Preferred time */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred time</label>
                <input
                  type="time"
                  {...register("recurringTime")}
                  className="mt-1 block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Escrow notice */}
        {isRecurring ? (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-800">🔄 Recurring payment schedule</p>
            <p className="mt-1 text-xs text-purple-600">
              Your card on file will be charged the morning of each scheduled occurrence — not upfront.
              Funds are escrowed until you verify completion, same as a one-off job, just repeated automatically.
              A valid payment method is required to set up a recurring job.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">💳 Payment held in escrow</p>
            <p className="mt-1 text-xs text-blue-600">
              Your card on file will be charged the budget amount when you post this job. 
              Funds are held securely in escrow until you verify the work is completed. 
              You won't be charged again — the escrowed amount is released to the vendor only after your approval.
            </p>
          </div>
        )}

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
  );
}

export default function CreateJobPage() {
  return (
    <AuthGuard requiredRole="Customer">
      <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-8"><Spinner /></div>}>
        <CreateJobFormContent />
      </Suspense>
    </AuthGuard>
  );
}
