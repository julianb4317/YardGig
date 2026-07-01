"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { ShieldCheck, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fetchVendorProfile, updateVendorProfile } from "@/lib/api/profiles";
import { uploadFiles } from "@/lib/api/uploads";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";

export function VendorInsuranceForm() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ["vendorProfile"], queryFn: fetchVendorProfile });

  const [carrier, setCarrier] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [liabilityType, setLiabilityType] = useState("");
  const [liabilityAmount, setLiabilityAmount] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Populate when profile loads
  const populated = useRef(false);
  if (profile && !populated.current) {
    populated.current = true;
    setCarrier(profile.insuranceCarrier ?? "");
    setExpirationDate(profile.insuranceExpirationDate?.slice(0, 10) ?? "");
    setLiabilityType(profile.insuranceLiabilityType ?? "");
    setLiabilityAmount(profile.insuranceLiabilityAmountCents ? String(profile.insuranceLiabilityAmountCents / 100) : "");
  }

  const saveMut = useMutation({
    mutationFn: () => updateVendorProfile({
      insuranceCarrier: carrier || undefined,
      insuranceExpirationDate: expirationDate || undefined,
      insuranceLiabilityType: liabilityType || undefined,
      insuranceLiabilityAmountCents: liabilityAmount ? Math.round(Number(liabilityAmount) * 100) : undefined,
    }),
    onSuccess: () => { toast.success("Insurance details saved."); queryClient.invalidateQueries({ queryKey: ["vendorProfile"] }); },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to save."),
  });

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const urls = await uploadFiles(files, "insurance_doc");
      await updateVendorProfile({ insuranceDocUrl: urls[0] });
      toast.success("Insurance document uploaded!");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
    } catch {
      toast.error("Upload failed.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  if (isLoading) return <Spinner className="mx-auto" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Insurance</h2>
        {profile?.insuranceVerified ? (
          <span className="flex items-center gap-1 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <ShieldCheck className="h-4 w-4" /> Verified
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <AlertTriangle className="h-4 w-4" /> Not Verified
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Upload your insurance documents to get verified. Verified vendors display a shield icon, building trust with customers.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-600">Insurance Carrier</label>
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g., State Farm, GEICO" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Expiration Date</label>
          <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Liability Type</label>
          <select value={liabilityType} onChange={(e) => setLiabilityType(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
            <option value="">Select...</option>
            <option value="General Liability">General Liability</option>
            <option value="Commercial Auto">Commercial Auto</option>
            <option value="Workers Compensation">Workers Compensation</option>
            <option value="Umbrella / Excess">Umbrella / Excess</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Liability Amount ($)</label>
          <input type="number" value={liabilityAmount} onChange={(e) => setLiabilityAmount(e.target.value)} placeholder="e.g., 1000000" min={0} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
      </div>

      {/* Document upload */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Proof of Insurance (upload)</label>
        {profile?.insuranceDocUrl && (
          <p className="text-xs text-green-600 mb-2">✓ Document on file</p>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {isUploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {isUploading ? "Uploading..." : "Upload Document"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleDocUpload} />
      </div>

      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
      >
        {saveMut.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
        Save Insurance Details
      </button>
    </div>
  );
}
