import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,   // 30 s before background refetch
      gcTime:               5 * 60_000, // 5 min cache retention
      retry:                1,
      refetchOnWindowFocus: false,    // real-time listeners handle freshness
    },
    mutations: {
      retry: 0,
    },
  },
});
