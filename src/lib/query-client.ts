import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  foods: (userId?: string | null) => ['foods', userId ?? 'anon'] as const,
  recipes: (userId?: string | null) => ['recipes', userId ?? 'anon'] as const,
  patients: (userId?: string | null) => ['patients', userId ?? 'anon'] as const,
} as const;

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});
