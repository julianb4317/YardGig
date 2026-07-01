"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { ArrowLeft, Calendar, MapPin, Tag, DollarSign, Clock, RefreshCw, Upload, Camera } from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorState } from "@/components/ui/error-state";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { PhotoGrid } from "@/components/ui/photo-lightbox";
import { CategoryDetailsDisplay } from "@/components/jobs/category-details-fields";
import { JobActions } from "@/components/jobs/job-actions";
import { PaymentButton } from "@/components/payments/payment-button";
import { RequestJobDialog } from "@/components/jobs/request-job-dialog";
import { JobChat } from "@/components/jobs/job-chat";
import { fetchJobDetail } from "@/lib/api/jobs";
import { uploadFiles } from "@/lib/api/uploads";
import { formatCents, cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/types";
import { hasRole } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-green-100 text-green-800",
  Requested: "bg-blue-100 text-blue-800",
  Assigned: "bg-purple-100 text-purple-800",
  InProgress: "bg-yellow-100 text-yellow-800",
  Completed: "bg-teal-100 text-teal-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Closed: "bg-gray-100 text-gray-600",
  Cancelled: "bg-red-100 text-red-700",
  Expired: "bg-amber-100 text-amber-800",
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: job, isLoading, isError, refetch } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJobDetail(id),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (isError || !job) {
    return (
      <AuthGuard>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <ErrorState title="Job not found" message="This job may have been removed." onRetry={() => refetch()} />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back link */}
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-medium", STATUS_COLORS[job.status] ?? "bg-gray-100")}>
            {job.status === "InProgress" ? "In Progress" : job.status}
          </span>
        </div>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5 font-semibold text-gray-900 text-base">
            <DollarSign className="h-4 w-4 text-brand-600" />
            {job.pricingType === "hourly"
              ? `${formatCents(job.hourlyRateCents ?? 0)}/hr`
              : formatCents(job.budgetCents)
            }
            {job.originalBudgetCents && job.originalBudgetCents !== job.budgetCents && (
              <span className={`text-xs font-medium ${job.budgetCents > job.originalBudgetCents ? "text-green-600" : "text-red-600"}`}>
                ({job.budgetCents > job.originalBudgetCents ? "↑" : "↓"} from {formatCents(job.originalBudgetCents)})
              </span>
            )}
          </span>

          {/* Hourly pricing details */}
          {job.pricingType === "hourly" && (
            <span className="flex items-center gap-1.5 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700">
              ⏱ Hourly · Est. {job.estimatedHours}h · Max {job.maxHours}h · Budget {formatCents(job.budgetCents)}
            </span>
          )}

          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {job.address}
          </span>

          {job.scheduleStart && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(job.scheduleStart).toLocaleDateString()}
              {job.scheduleEnd && ` – ${new Date(job.scheduleEnd).toLocaleDateString()}`}
            </span>
          )}

          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Posted {new Date(job.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Categories */}
        <div className="mt-4 flex flex-wrap gap-2">
          {job.categories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-700">
              <Tag className="h-3.5 w-3.5" />
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
          ))}
        </div>

        {/* Description */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Description</h2>
          <p className="mt-2 text-gray-700 whitespace-pre-wrap">{job.description}</p>
        </div>

        {/* Category-specific job details */}
        <CategoryDetailsDisplay categories={job.categories} detailsJson={job.jobDetailsJson} />

        {/* Recurring schedule info */}
        {job.isRecurring && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-medium text-brand-800">Recurring Job</span>
            </div>
            <div className="mt-2 text-sm text-brand-700 space-y-1">
              {job.recurringFrequency && (
                <p>Frequency: <span className="font-medium capitalize">{job.recurringFrequency}</span></p>
              )}
              {job.recurringDays && job.recurringDays.length > 0 && (
                <p>Days: <span className="font-medium">{job.recurringDays.join(", ")}</span></p>
              )}
              {job.recurringTime && (
                <p>Preferred time: <span className="font-medium">{job.recurringTime}</span></p>
              )}
            </div>
          </div>
        )}

        {/* Hourly pricing info */}
        {job.pricingType === "hourly" && (
          <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-800">Hourly Pricing</span>
            </div>
            <div className="mt-2 text-sm text-indigo-700">
              <span className="font-medium">${((job.hourlyRateCents ?? 0) / 100).toFixed(0)}/hr</span>
              {job.estimatedHours && <span> · Est. {job.estimatedHours}h</span>}
              {job.maxHours && <span> · Max {job.maxHours}h</span>}
            </div>
          </div>
        )}

        {/* Photos */}
        {job.photos && job.photos.length > 0 && (
          <PhotoGrid
            photos={job.photos}
            label={job.status === "Completed" || job.status === "Paid" || job.status === "Closed" ? "Completion Photos" : "Photos"}
          />
        )}

        {/* Customer: upload reference photos (optional) */}
        {hasRole("Customer") && ["Open", "Requested", "Assigned"].includes(job.status) && (
          <CustomerPhotoUpload jobId={job.id} existingPhotos={job.photos} />
        )}

        {/* Job Actions */}
        <div className="mt-8 border-t pt-6 space-y-4">
          <JobActions job={job} />

          {/* Customer: Edit job (only when Open) */}
          {hasRole("Customer") && job.status === "Open" && (
            <Link
              href={`/jobs/${job.id}/edit`}
              className="inline-flex items-center gap-2 rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              ✏️ Edit Job
            </Link>
          )}

          {/* Post Again button for past jobs */}
          {hasRole("Customer") && ["Paid", "Closed", "Cancelled", "Expired"].includes(job.status) && (
            <PostAgainButton job={job} />
          )}

          {/* Customer: payment button when completed */}
          {hasRole("Customer") && job.status === "Completed" && (
            <PaymentButton
              jobId={job.id}
              budgetCents={job.budgetCents}
              assignedVendorId={job.assignedVendorUserId ?? undefined}
              assignedVendorName={job.assignedVendorName ?? undefined}
              pricingType={job.pricingType}
              hourlyRateCents={job.hourlyRateCents}
              estimatedHours={job.estimatedHours}
              maxHours={job.maxHours}
              assignmentStartedAt={job.assignmentStartedAt}
              assignmentCompletedAt={job.assignmentCompletedAt}
            />
          )}

          {/* Customer: view vendor requests */}
          {hasRole("Customer") && (job.status === "Requested" || job.status === "Open") && (
            <Link
              href={`/jobs/${job.id}/requests`}
              className="inline-block rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              View Vendor Requests
            </Link>
          )}

          {/* Vendor: request this job */}
          {hasRole("Vendor") && (job.status === "Open" || job.status === "Requested") && !job.vendorHasRequested && (
            <VendorRequestSection jobId={job.id} jobTitle={job.title} />
          )}
          {hasRole("Vendor") && (job.status === "Open" || job.status === "Requested") && job.vendorHasRequested && (
            <button
              disabled
              className="w-full sm:w-auto rounded-md bg-gray-400 px-6 py-3 text-sm font-medium text-white cursor-not-allowed opacity-70"
            >
              ✓ Request Submitted
            </button>
          )}

          {/* Chat: available once a vendor is assigned */}
          {["Assigned", "InProgress", "Completed", "Paid"].includes(job.status) && (
            <div className="mt-4">
              <JobChat jobId={job.id} />
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function VendorRequestSection({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="w-full sm:w-auto rounded-md bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
      >
        🙋 Request This Job
      </button>
      <RequestJobDialog
        jobId={jobId}
        jobTitle={jobTitle}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

function PostAgainButton({ job }: { job: { title: string; description: string; categories: string[]; address: string; budgetCents: number; isRecurring?: boolean; recurringFrequency?: string | null; recurringDays?: string[] | null; recurringTime?: string | null } }) {
  const router = useRouter();

  const handlePostAgain = () => {
    const params = new URLSearchParams({
      title: job.title,
      description: job.description,
      categories: job.categories.join(","),
      address: job.address,
      budget: String(job.budgetCents / 100),
    });
    if (job.isRecurring) {
      params.set("isRecurring", "true");
      if (job.recurringFrequency) params.set("recurringFrequency", job.recurringFrequency);
      if (job.recurringDays) params.set("recurringDays", job.recurringDays.join(","));
      if (job.recurringTime) params.set("recurringTime", job.recurringTime);
    }
    router.push(`/jobs/create?${params}`);
  };

  return (
    <button
      onClick={handlePostAgain}
      className="inline-flex items-center gap-2 rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
    >
      <RefreshCw className="h-4 w-4" />
      Post Again
    </button>
  );
}

function CustomerPhotoUpload({ jobId, existingPhotos }: { jobId: string; existingPhotos: string[] | null }) {
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos((p) => [...p, ...files].slice(0, 5));
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (photos.length === 0) return;
    setIsUploading(true);
    try {
      const uploadedUrls = await uploadFiles(photos, "job_photo");
      const allPhotos = [...(existingPhotos ?? []), ...uploadedUrls];
      // Update the job with the new photos
      await apiClient(`/api/jobs/${jobId}`, {
        method: "PUT",
        body: { photos: allPhotos },
      });
      toast.success("Photos uploaded!");
      setPhotos([]);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    } catch {
      toast.error("Failed to upload photos.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Reference Photos (Optional)</h2>
      <p className="mt-1 text-xs text-gray-400">Add photos to help the vendor understand the work needed.</p>

      {photos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {photos.map((f, i) => (
            <div key={i} className="relative">
              <img src={URL.createObjectURL(f)} alt="" className="h-20 w-full rounded object-cover" />
              <button onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {photos.length < 5 && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
              <Upload className="h-4 w-4" /> Browse
            </button>
            <button type="button" onClick={() => camRef.current?.click()} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
              <Camera className="h-4 w-4" /> Camera
            </button>
          </>
        )}
        {photos.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isUploading && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            {isUploading ? "Uploading..." : "Save Photos"}
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
    </div>
  );
}
