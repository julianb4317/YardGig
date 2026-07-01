"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatCents } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

interface ReceiptItem {
  id: string;
  jobRequestId: string;
  jobTitle: string;
  pricingType: string;
  amountCents: number;
  platformFeeCents: number;
  vendorEarnedCents: number;
  budgetCents: number;
  hourlyRateCents: number | null;
  capturedAt: string | null;
  createdAt: string;
}

interface ReceiptsResponse {
  receipts: ReceiptItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function CustomerReceipts() {
  const { data, isLoading } = useQuery({
    queryKey: ["customerReceipts"],
    queryFn: () => apiClient<ReceiptsResponse>("/api/payments/receipts?pageSize=50"),
  });

  const handleDownload = (receipt: ReceiptItem) => {
    // Generate a text receipt and download as file
    const date = receipt.capturedAt ? new Date(receipt.capturedAt).toLocaleDateString() : new Date(receipt.createdAt).toLocaleDateString();
    const lines = [
      "═══════════════════════════════════",
      "          RAKR RECEIPT",
      "═══════════════════════════════════",
      "",
      `Date:          ${date}`,
      `Receipt #:     ${receipt.id.slice(0, 8).toUpperCase()}`,
      `Job:           ${receipt.jobTitle}`,
      `Type:          ${receipt.pricingType === "hourly" ? "Hourly" : "Fixed Price"}`,
      "",
      "───────────────────────────────────",
      `Vendor Payment:     ${formatCents(receipt.vendorEarnedCents)}`,
      `Trust & Escrow Fee: ${formatCents(receipt.platformFeeCents)}`,
      `Processing Fee:     ${formatCents(receipt.amountCents - receipt.vendorEarnedCents - receipt.platformFeeCents)}`,
      "───────────────────────────────────",
      `TOTAL CHARGED:      ${formatCents(receipt.amountCents)}`,
      "",
      "═══════════════════════════════════",
      "Thank you for using Rakr!",
      "═══════════════════════════════════",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakr-receipt-${receipt.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Spinner className="mx-auto" />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="h-5 w-5 text-brand-600" />
        <h2 className="text-lg font-semibold">Receipts</h2>
      </div>

      {(!data || data.receipts.length === 0) && (
        <EmptyState
          title="No receipts yet"
          message="Receipts will appear here once you've paid for completed jobs."
        />
      )}

      {data && data.receipts.length > 0 && (
        <div className="space-y-2">
          {data.receipts.map((receipt) => (
            <div key={receipt.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{receipt.jobTitle}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                  <span>{receipt.capturedAt ? new Date(receipt.capturedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}</span>
                  <span className={receipt.pricingType === "hourly" ? "text-purple-600" : "text-gray-500"}>
                    {receipt.pricingType === "hourly" ? "⏱ Hourly" : "Fixed"}
                  </span>
                  <span>Vendor: {formatCents(receipt.vendorEarnedCents)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">{formatCents(receipt.amountCents)}</span>
                <button
                  onClick={() => handleDownload(receipt)}
                  className="rounded-md border border-gray-200 p-2 text-gray-400 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50"
                  title="Download receipt"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {data.totalCount > data.receipts.length && (
            <p className="text-center text-xs text-gray-400 pt-2">
              Showing {data.receipts.length} of {data.totalCount} receipts
            </p>
          )}
        </div>
      )}
    </div>
  );
}
