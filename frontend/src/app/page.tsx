import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Yard work, <span className="text-brand-600">simplified.</span>
      </h1>
      <p className="mt-4 max-w-md text-lg text-gray-600">
        Post a job or find work near you. Local vendors, transparent pricing, instant map discovery.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/auth/register"
          className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700 transition"
        >
          Get Started
        </Link>
        <Link
          href="/auth/login"
          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium hover:bg-gray-50 transition"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
