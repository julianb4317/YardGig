"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Spinner } from "@/components/ui/spinner";
import { createJob } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api-client";
import { JOB_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { CategoryDetailsFields, type JobDetails } from "@/components/jobs/category-details-fields";
import { fetchAddresses } from "@/lib/api/addresses";
import type { CustomerAddress } from "@/lib/api/addresses";

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
  pricingType: z.enum(["fixed", "hourly"]).default("fixed"),
  budgetDollars: z.number({ invalid_type_error: "Enter a budget" }).min(1, "Min $1").max(10000, "Max $10,000").optional().or(z.nan().transform(() => undefined)),
  hourlyRate: z.number().optional().or(z.nan().transform(() => undefined)),
  estimatedHours: z.number().optional().or(z.nan().transform(() => undefined)),
  maxHours: z.number().optional().or(z.nan().transform(() => undefined)),
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.string().optional(),
  recurringDays: z.array(z.string()).optional(),
  recurringTime: z.string().optional(),
}).superRefine((data, ctx) => {
  const now = new Date();

  if (data.pricingType === "fixed") {
    if (!data.budgetDollars || data.budgetDollars < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Budget is required for fixed-price jobs (min $1)",
        path: ["budgetDollars"],
      });
    }
  }

  if (data.pricingType === "hourly") {
    if (!data.hourlyRate || data.hourlyRate < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hourly rate required (min $5)",
        path: ["hourlyRate"],
      });
    }
    if (!data.estimatedHours || data.estimatedHours < 0.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estimated hours required (min 0.5)",
        path: ["estimatedHours"],
      });
    }
    if (!data.maxHours || data.maxHours < 0.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max hours required (min 0.5)",
        path: ["maxHours"],
      });
    }
    if (data.maxHours && data.estimatedHours && data.maxHours < data.estimatedHours) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max hours must be ≥ estimated hours",
        path: ["maxHours"],
      });
    }
  }

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
    defaultValues: { categories: [], isRecurring: false, recurringDays: [], pricingType: "fixed" },
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
  const pricingType = useWatch({ control, name: "pricingType" });
  const [jobDetails, setJobDetails] = useState<JobDetails>({});

  // Fetch saved addresses for the picker
  const { data: savedAddresses } = useQuery({
    queryKey: ["customerAddresses"],
    queryFn: fetchAddresses,
  });
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const hourlyRate = watch("hourlyRate");
  const estimatedHours = watch("estimatedHours");
  const maxHours = watch("maxHours");
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
    mutationFn: (data: CreateJobForm) => {
      const isHourly = data.pricingType === "hourly";
      const budgetCents = isHourly
        ? Math.round((data.hourlyRate ?? 0) * (data.maxHours ?? 0) * 100)
        : Math.round((data.budgetDollars ?? 0) * 100);

      return createJob({
        title: data.title,
        description: data.description,
        categories: data.categories,
        address: data.address,
        budgetCents,
        scheduleStart: data.scheduleStart || undefined,
        scheduleEnd: data.scheduleEnd || undefined,
        isRecurring: data.isRecurring || false,
        recurringFrequency: data.isRecurring ? data.recurringFrequency : undefined,
        recurringDays: data.isRecurring ? data.recurringDays : undefined,
        recurringTime: data.isRecurring ? data.recurringTime : undefined,
        pricingType: data.pricingType,
        hourlyRateCents: isHourly ? Math.round((data.hourlyRate ?? 0) * 100) : undefined,
        estimatedHours: isHourly ? data.estimatedHours : undefined,
        maxHours: isHourly ? data.maxHours : undefined,
        jobDetailsJson: Object.keys(jobDetails).length > 0 ? JSON.stringify(jobDetails) : undefined,
      });
    },
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
        {/* Address (first — auto-populates job details) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Property Address</label>
          <p className="text-xs text-gray-400 mb-1">Select a saved address to auto-fill property details, or enter a new one.</p>
          {savedAddresses && savedAddresses.length > 0 ? (
            <>
              <select
                value={selectedAddressId}
                onChange={(e) => {
                  const addrId = e.target.value;
                  setSelectedAddressId(addrId);
                  if (addrId === "__new__") {
                    setValue("address", "");
                    setJobDetails({});
                  } else {
                    const addr = savedAddresses.find((a: CustomerAddress) => a.id === addrId);
                    if (addr) {
                      setValue("address", addr.formattedAddress, { shouldValidate: true });
                      // Auto-populate job details from address
                      if (addr.jobDetailsJson) {
                        try { setJobDetails(JSON.parse(addr.jobDetailsJson)); } catch {}
                      } else {
                        setJobDetails({});
                      }
                    }
                  }
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select a saved address...</option>
                {savedAddresses.map((addr: CustomerAddress) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.isDefault ? "⭐ " : ""}{addr.label} — {addr.formattedAddress}
                  </option>
                ))}
                <option value="__new__">+ Enter a new address</option>
              </select>
              {(selectedAddressId === "__new__" || selectedAddressId === "") && (
                <input
                  {...register("address")}
                  placeholder="Full street address"
                  className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
            </>
          ) : (
            <input
              {...register("address")}
              placeholder="Full street address"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          )}
          {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
        </div>

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

        {/* Category-specific details */}
        {selectedCategories && selectedCategories.length > 0 && (
          <CategoryDetailsFields
            categories={selectedCategories}
            value={jobDetails}
            onChange={setJobDetails}
          />
        )}

        {/* Pricing Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pricing</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="fixed"
                {...register("pricingType")}
                className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700">Fixed Price</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="hourly"
                {...register("pricingType")}
                className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700">Hourly Rate</span>
            </label>
          </div>
        </div>

        {/* Fixed Price Budget */}
        {pricingType === "fixed" && (
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
        )}

        {/* Hourly Rate Fields */}
        {pricingType === "hourly" && (
          <div className="space-y-4 rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Hourly Rate ($)</label>
                <input
                  {...register("hourlyRate", { valueAsNumber: true })}
                  type="number"
                  min={5}
                  max={500}
                  step={1}
                  placeholder="25"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {errors.hourlyRate && <p className="mt-1 text-xs text-red-600">{errors.hourlyRate.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Estimated Hours</label>
                <input
                  {...register("estimatedHours", { valueAsNumber: true, onChange: (e) => {
                    const est = parseFloat(e.target.value);
                    if (est > 0 && (!maxHours || maxHours < est)) {
                      setValue("maxHours", Math.round(est * 1.5 * 10) / 10);
                    }
                  }})}
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  placeholder="3"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {errors.estimatedHours && <p className="mt-1 text-xs text-red-600">{errors.estimatedHours.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Hours</label>
                <input
                  {...register("maxHours", { valueAsNumber: true })}
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  placeholder="4.5"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {errors.maxHours && <p className="mt-1 text-xs text-red-600">{errors.maxHours.message}</p>}
              </div>
            </div>

            {/* Computed values */}
            {hourlyRate && estimatedHours && maxHours && (
              <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
                <div>
                  <span className="text-gray-500">Estimated Budget</span>
                  <p className="font-medium text-gray-900">${(hourlyRate * estimatedHours).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Maximum Charge</span>
                  <p className="font-medium text-gray-900">${(hourlyRate * maxHours).toFixed(2)}</p>
                </div>
              </div>
            )}
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

        {/* Fee breakdown & escrow notice */}
        {isRecurring ? (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-800">🔄 Recurring payment schedule</p>
            <p className="mt-1 text-xs text-purple-600">
              Your card on file will be charged the morning of each scheduled occurrence — not upfront.
              The fees below apply to each occurrence. Funds are held until you verify completion.
              A valid payment method is required to set up a recurring job.
            </p>
          </div>
        ) : pricingType === "hourly" ? (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-800">⏱ Hourly Job — Authorization Hold</p>
            <div className="mt-2 text-xs text-purple-600 space-y-1.5">
              <p><strong>When you post:</strong> A hold for the maximum amount (rate × max hours + fees) is placed on your card. You are NOT charged yet.</p>
              <p><strong>When you assign a vendor:</strong> The hold remains — still no charge.</p>
              <p><strong>When work is complete:</strong> You'll review the actual hours worked and approve the final amount. Only then is your card charged for the actual hours — not the maximum.</p>
              <p><strong>If you cancel before assignment:</strong> The hold is released. $0 charged.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">🔒 Fixed Price — Authorization Hold</p>
            <div className="mt-2 text-xs text-blue-600 space-y-1.5">
              <p><strong>When you post:</strong> A hold for the full amount (budget + fees) is placed on your card. You are NOT charged yet.</p>
              <p><strong>When you assign a vendor:</strong> The hold remains — still no charge.</p>
              <p><strong>When work is complete:</strong> You verify the work, your card is charged, and funds are released to the vendor.</p>
              <p><strong>If you cancel before verification:</strong> The hold is released. $0 charged.</p>
            </div>
          </div>
        )}

        {/* Live fee preview */}
        {pricingType === "fixed" && watch("budgetDollars") && watch("budgetDollars")! > 0 && (
          <FeePreview budgetDollars={watch("budgetDollars")!} />
        )}
        {pricingType === "hourly" && hourlyRate && maxHours && hourlyRate > 0 && maxHours > 0 && (
          <FeePreview budgetDollars={hourlyRate * maxHours} label="Maximum fees (based on max hours)" />
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
          Post Job & Authorize Hold
        </button>
      </form>
    </div>
  );
}

function FeePreview({ budgetDollars, label }: { budgetDollars: number; label?: string }) {
  const budgetCents = Math.round((budgetDollars || 0) * 100);

  // Calculate fees client-side for instant preview (matches backend logic: 10% + 2.9% + $0.30)
  if (budgetCents < 100) return null;

  const trustFeeCents = Math.ceil(budgetCents * 0.10);
  const subtotal = budgetCents + trustFeeCents;
  const processingFeeCents = Math.ceil(subtotal * 0.029) + 30;
  const totalCents = subtotal + processingFeeCents;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">{label || "Fee Breakdown"}</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Job Budget (goes to vendor)</span>
          <span className="font-medium">${(budgetCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Trust & Escrow Fee (10%)</span>
          <span className="font-medium">${(trustFeeCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Secure Payment Processing (2.9% + $0.30)</span>
          <span className="font-medium">${(processingFeeCents / 100).toFixed(2)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-semibold">
          <span className="text-gray-900">Total</span>
          <span className="text-gray-900">${(totalCents / 100).toFixed(2)}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Your vendor receives the full ${(budgetCents / 100).toFixed(2)} — fees are separate.
      </p>
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
