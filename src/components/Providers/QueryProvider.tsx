// https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr#initial-setup
"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  
  const browserQueryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  return (
    <QueryClientProvider client={browserQueryClient}>
      {children}
    </QueryClientProvider>
  )
}
