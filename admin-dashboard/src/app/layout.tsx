import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = { title: "Rakr Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
          </div>
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
