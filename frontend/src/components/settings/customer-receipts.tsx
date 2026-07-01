"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt, Download } from "lucide-react";
import Link from "next/link";
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

function generateReceiptPdf(receipt: ReceiptItem) {
  const date = receipt.capturedAt
    ? new Date(receipt.capturedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : new Date(receipt.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const receiptNum = receipt.id.slice(0, 8).toUpperCase();
  const processingFee = receipt.amountCents - receipt.vendorEarnedCents - receipt.platformFeeCents;

  // Generate a styled HTML document and print to PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Rakr Receipt ${receiptNum}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 48px; color: #1f2937; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; }
    .brand { font-size: 28px; font-weight: 700; color: #16a34a; letter-spacing: -0.5px; }
    .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .receipt-info { display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
    .receipt-info div { font-size: 13px; color: #4b5563; }
    .receipt-info strong { color: #1f2937; }
    .job-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .job-type { font-size: 12px; color: #7c3aed; background: #f5f3ff; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 20px; }
    .line-items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .line-items td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
    .line-items td:last-child { text-align: right; font-weight: 500; }
    .total-row td { border-top: 2px solid #1f2937; border-bottom: none; font-weight: 700; font-size: 16px; padding-top: 12px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Rakr</div>
    <div class="subtitle">Payment Receipt</div>
  </div>

  <div class="receipt-info">
    <div><strong>Receipt #:</strong> ${receiptNum}</div>
    <div><strong>Date:</strong> ${date}</div>
  </div>

  <div class="job-title">${receipt.jobTitle}</div>
  <div class="job-type">${receipt.pricingType === "hourly" ? "⏱ Hourly" : "Fixed Price"}</div>

  <table class="line-items">
    <tr>
      <td>Vendor Payment</td>
      <td>${formatCents(receipt.vendorEarnedCents)}</td>
    </tr>
    <tr>
      <td>Trust & Escrow Fee</td>
      <td>${formatCents(receipt.platformFeeCents)}</td>
    </tr>
    <tr>
      <td>Payment Processing</td>
      <td>${formatCents(processingFee)}</td>
    </tr>
    <tr class="total-row">
      <td>Total Charged</td>
      <td>${formatCents(receipt.amountCents)}</td>
    </tr>
  </table>

  <div class="footer">
    <p>Thank you for using Rakr!</p>
    <p style="margin-top: 4px;">This receipt was generated automatically. For questions, contact support.</p>
  </div>
</body>
</html>`;

  // Open a new window and print (triggers PDF save dialog)
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export function CustomerReceipts() {
  const { data, isLoading } = useQuery({
    queryKey: ["customerReceipts"],
    queryFn: () => apiClient<ReceiptsResponse>("/api/payments/receipts?pageSize=50"),
  });

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
                <Link href={`/jobs/${receipt.jobRequestId}`} className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline truncate block">
                  {receipt.jobTitle}
                </Link>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                  <span>{receipt.capturedAt ? new Date(receipt.capturedAt.endsWith("Z") ? receipt.capturedAt : receipt.capturedAt + "Z").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}</span>
                  <span className={receipt.pricingType === "hourly" ? "text-purple-600" : "text-gray-500"}>
                    {receipt.pricingType === "hourly" ? "⏱ Hourly" : "Fixed"}
                  </span>
                  <span>Vendor: {formatCents(receipt.vendorEarnedCents)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">{formatCents(receipt.amountCents)}</span>
                <button
                  onClick={() => generateReceiptPdf(receipt)}
                  className="rounded-md border border-gray-200 p-2 text-gray-400 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50"
                  title="Download receipt (PDF)"
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
