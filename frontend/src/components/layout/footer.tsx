import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} YardGig. All rights reserved.</p>
          <nav className="flex gap-4 text-sm text-gray-500">
            <Link href="/legal/terms" className="hover:text-gray-700">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/legal/ccpa-notice" className="hover:text-gray-700">Do Not Sell My Info</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
