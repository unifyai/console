// https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr#initial-setup
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false, // Disable automatic refetch on tab focus
            retry: (failureCount, error) => {
              // Don't retry on 4xx client errors (e.g., 404 Not Found, 401 Unauthorized)
              if (error instanceof Error && /4\d\d/.test(error.message)) {
                return false;
              }
              // Default: retry up to 3 times for other errors
              return failureCount < 3;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
