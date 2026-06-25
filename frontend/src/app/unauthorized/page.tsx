import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldAlert className="h-16 w-16 text-red-400" />
      <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
      <p className="mt-2 text-gray-500">You don't have permission to view this page.</p>
      <Link href="/" className="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
        Go Home
      </Link>
    </div>
  );
}
