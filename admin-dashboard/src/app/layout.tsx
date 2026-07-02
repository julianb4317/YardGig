import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";
import { AdminShell } from "@/components/layout/admin-shell";

export const metadata: Metadata = { title: "Rakr Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <AdminShell>{children}</AdminShell>
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
