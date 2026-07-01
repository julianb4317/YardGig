"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useRef } from "react";
import { ArrowLeft, Upload, Camera } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Spinner } from "@/components/ui/spinner";
import { apiClient, ApiError } from "@/lib/api-client";
import { uploadFiles } from "@/lib/api/uploads";

const disputeSchema = z.object({
  summary: z.string().min(5, "Summary required (min 5 chars)").max(200),
  reason: z.string().min(20, "Please provide more detail (min 20 chars)").max(5000),
});

type DisputeForm = z.infer<typeof disputeSchema>;

function CreateDisputeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? "";
  const jobTitle = searchParams.get("jobTitle") ?? "Job";

  const [photos, setPhotos] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<DisputeForm>({
    resolver: zodResolver(disputeSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: DisputeForm) => {
      let evidencePhotos: string[] | undefined;
      if (photos.length > 0) {
        setIsUploading(true);
        try {
          evidencePhotos = await uploadFiles(photos, "job_photo");
        } finally {
          setIsUploading(false);
        }
      }
      return apiClient<{ disputeId: string; disputeNumber: string }>("/api/disputes", {
        method: "POST",
        body: {
          jobRequestId: jobId,
          summary: data.summary,
          reason: data.reason,
          evidencePhotos,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`Dispute filed: ${result.disputeNumber}`);
      router.push(`/disputes/${result.disputeId}`);
    },
    onError: (err: ApiError) => {
      toast.error(err.errors[0] ?? "Failed to file dispute.");
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos((p) => [...p, ...files].slice(0, 5));
    e.target.value = "";
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-bold">File a Dispute</h1>
      <p className="mt-1 text-sm text-gray-500">Regarding: <span className="font-medium text-gray-700">{jobTitle}</span></p>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="mt-8 space-y-6">
        {/* Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Summary</label>
          <input
            {...register("summary")}
            placeholder="Brief description of the issue"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {errors.summary && <p className="mt-1 text-xs text-red-600">{errors.summary.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Detailed Description</label>
          <textarea
            {...register("reason")}
            rows={5}
            placeholder="Explain the issue in detail — what happened, what you expected, and what resolution you're looking for."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>}
        </div>

        {/* Evidence photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Evidence (optional)</label>
          <p className="text-xs text-gray-400 mb-2">Upload photos or screenshots that support your dispute.</p>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt="" className="h-20 w-full rounded object-cover" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
                </div>
              ))}
            </div>
          )}

          {photos.length < 5 && (
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                <Upload className="h-4 w-4" /> Browse
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                <Camera className="h-4 w-4" /> Camera
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />
          <p className="mt-1 text-xs text-gray-400">{photos.length}/5 photos</p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending || isUploading}
          className="w-full rounded-md bg-red-600 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {(mutation.isPending || isUploading) && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
          {isUploading ? "Uploading evidence..." : "Submit Dispute"}
        </button>
      </form>
    </div>
  );
}

export default function CreateDisputePage() {
  return (
    <AuthGuard>
      <Suspense fallback={<Spinner />}>
        <CreateDisputeContent />
      </Suspense>
    </AuthGuard>
  );
}
