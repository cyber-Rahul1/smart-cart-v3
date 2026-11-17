// One QueryClient for the whole app; the provider in app/_layout.tsx uses
// this instance. Configured with optimal staleTimes, garbage collection,
// and deduplication to keep navigation and interactions instantaneous like Swiggy.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds fresh cache by default
      gcTime: 1000 * 60 * 10, // Keep inactive cache for 10 minutes
      refetchOnWindowFocus: false, // Avoid excessive refetches on mobile focus
      retry: 1, // Only retry once quickly if failed
    },
  },
});
