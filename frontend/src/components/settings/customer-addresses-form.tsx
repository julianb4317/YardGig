"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Plus, Star, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { fetchAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } from "@/lib/api/addresses";
import type { CustomerAddress } from "@/lib/api/addresses";
import { CategoryDetailsFields, type JobDetails } from "@/components/jobs/category-details-fields";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { JOB_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";

export function CustomerAddressesForm() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["customerAddresses"],
    queryFn: fetchAddresses,
  });

  const deleteMut = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => { toast.success("Address removed."); queryClient.invalidateQueries({ queryKey: ["customerAddresses"] }); },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to delete."),
  });

  const defaultMut = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () => { toast.success("Default address updated."); queryClient.invalidateQueries({ queryKey: ["customerAddresses"] }); },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to set default."),
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">My Addresses</h2>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Address
        </button>
      </div>

      {(!addresses || addresses.length === 0) && !showAdd && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <MapPin className="h-8 w-8 text-gray-300 mx-auto" />
          <p className="mt-2 text-sm font-medium text-gray-600">No addresses saved</p>
          <p className="text-xs text-gray-400">Add your first address to quickly create jobs.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add Address
          </button>
        </div>
      )}

      {addresses && addresses.length > 0 && (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="rounded-lg border border-gray-200 p-4">
              {editingId === addr.id ? (
                <AddressForm
                  address={addr}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{addr.label}</span>
                      {addr.isDefault && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          <Star className="h-3 w-3" /> Default
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">{addr.formattedAddress}</p>
                    {addr.jobDetailsJson && (
                      <p className="mt-1 text-xs text-brand-600">✓ Job details saved for this address</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!addr.isDefault && (
                      <button onClick={() => defaultMut.mutate(addr.id)} className="rounded p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50" title="Set as default">
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => setEditingId(addr.id)} className="rounded p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50" title="Edit">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this address?")) deleteMut.mutate(addr.id); }} className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mt-4">
          <AddressForm onDone={() => setShowAdd(false)} />
        </div>
      )}
    </div>
  );
}

function AddressForm({ address, onDone }: { address?: CustomerAddress; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(address?.label ?? "");
  const [formattedAddress, setFormattedAddress] = useState(address?.formattedAddress ?? "");
  const [street, setStreet] = useState(address?.street ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [state, setState] = useState(address?.state ?? "");
  const [zip, setZip] = useState(address?.zip ?? "");
  const [jobDetails, setJobDetails] = useState<JobDetails>(() => {
    if (address?.jobDetailsJson) {
      try { return JSON.parse(address.jobDetailsJson); } catch { return {}; }
    }
    return {};
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (address?.jobDetailsJson) {
      try {
        const parsed = JSON.parse(address.jobDetailsJson);
        return Object.keys(parsed).filter((k) => parsed[k] && Object.keys(parsed[k]).length > 0);
      } catch { return []; }
    }
    return [];
  });

  const addMut = useMutation({
    mutationFn: () => addAddress({
      label,
      formattedAddress: formattedAddress || `${street}, ${city}, ${state} ${zip}`.trim(),
      street: street || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
      jobDetailsJson: Object.keys(jobDetails).length > 0 ? JSON.stringify(jobDetails) : undefined,
    }),
    onSuccess: () => {
      toast.success("Address added!");
      queryClient.invalidateQueries({ queryKey: ["customerAddresses"] });
      onDone();
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to save."),
  });

  const updateMut = useMutation({
    mutationFn: () => updateAddress(address!.id, {
      label,
      formattedAddress: formattedAddress || `${street}, ${city}, ${state} ${zip}`.trim(),
      street: street || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
      jobDetailsJson: Object.keys(jobDetails).length > 0 ? JSON.stringify(jobDetails) : undefined,
    }),
    onSuccess: () => {
      toast.success("Address updated!");
      queryClient.invalidateQueries({ queryKey: ["customerAddresses"] });
      onDone();
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to update."),
  });

  const handleSave = () => {
    if (!label.trim()) { toast.error("Label is required."); return; }
    if (!formattedAddress.trim() && !street.trim()) { toast.error("Address is required."); return; }
    if (address) updateMut.mutate();
    else addMut.mutate();
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const isPending = addMut.isPending || updateMut.isPending;

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-700">{address ? "Edit Address" : "New Address"}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Home, Mom's House" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600">Full Address</label>
          <input value={formattedAddress} onChange={(e) => setFormattedAddress(e.target.value)} placeholder="123 Main St, Denver, CO 80202" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600">State</label>
            <input value={state} onChange={(e) => setState(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Zip</label>
            <input value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Job details for this address */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Property details (optional — auto-fills when creating jobs)</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {JOB_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                selectedCategories.includes(cat) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-500"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        {selectedCategories.length > 0 && (
          <CategoryDetailsFields categories={selectedCategories} value={jobDetails} onChange={setJobDetails} />
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {isPending && <Spinner className="h-3.5 w-3.5 border-white border-t-transparent" />}
          {address ? "Update" : "Save Address"}
        </button>
      </div>
    </div>
  );
}
