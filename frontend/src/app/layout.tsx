import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Rakr — Yard Work Marketplace",
  description: "Find and hire local yard work professionals, or discover nearby jobs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
