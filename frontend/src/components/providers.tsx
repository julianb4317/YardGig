"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,         // Data fresh for 30s
            gcTime: 5 * 60_000,        // Cache retained 5min
            retry: (failureCount, error) => {
              // Don't retry on auth errors or not-found
              if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
                return false;
              }
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
            onError: (error) => {
              // Global mutation error handler
              if (error instanceof ApiError) {
                if (error.status === 429) {
                  toast.error("Too many requests. Please wait a moment.");
                }
                // Other errors handled by individual mutation onError
              }
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
