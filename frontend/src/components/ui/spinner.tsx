import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent", className)} />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-10 w-10" />
    </div>
  );
}
