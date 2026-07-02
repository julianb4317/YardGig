"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Info, RotateCcw } from "lucide-react";

export default function RefundsPage() {
  const [jobId, setJobId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // POST /api/admin/refunds is not yet implemented on the backend
    toast.info("Refund endpoint not wired yet. This form is ready for integration.");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Refunds</h2>

      {/* Coming soon notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-700">
          Refund functionality coming soon. The form below is ready for integration with{" "}
          <code className="bg-amber-100 px-1 rounded text-xs">POST /api/admin/refunds</code>.
        </p>
      </div>

      {/* Refund form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
        <h3 className="font-semibold text-gray-900 mb-4">Issue a Refund</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
            <input
              type="text"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder="Enter job ID"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for the refund..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={!jobId.trim() || !amount || !reason.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Issue Refund
          </button>
        </form>
      </div>
    </div>
  );
}
