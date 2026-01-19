/**
 * Test Providers
 *
 * Shared provider wrapper for test harnesses. Provides consistent
 * setup for Zustand store and React Query across all behavior tests.
 *
 * Usage:
 *   import { TestProviders } from '../utils/testProviders';
 *
 *   render(
 *     <TestProviders initialState={{ ... }}>
 *       <YourComponent />
 *     </TestProviders>
 *   );
 */
import React, { useMemo } from 'react';
import { QueryClient, QueryClientProvider, QueryClientConfig } from '@tanstack/react-query';
import { StoreProvider } from '@/contexts/providers/StoreProvider';
import { IStoreState } from '@/contexts/store';
import { TooltipProvider } from '@/components/UI/tooltip';

// =============================================================================
// Types
// =============================================================================

export interface TestProvidersProps {
  children: React.ReactNode;
  /** Initial state for the Zustand store */
  initialState?: Partial<IStoreState>;
  /** Custom QueryClient options (merged with defaults) */
  queryClientOptions?: Partial<QueryClientConfig>;
  /** Use an existing QueryClient instead of creating a new one */
  queryClient?: QueryClient;
}

// =============================================================================
// Default QueryClient Configuration
// =============================================================================

const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
};

/**
 * Creates a new QueryClient with test-friendly defaults.
 * Disables retries and garbage collection for predictable test behavior.
 */
export function createTestQueryClient(options?: Partial<QueryClientConfig>): QueryClient {
  return new QueryClient({
    ...defaultQueryClientConfig,
    ...options,
    defaultOptions: {
      ...defaultQueryClientConfig.defaultOptions,
      ...options?.defaultOptions,
      queries: {
        ...defaultQueryClientConfig.defaultOptions?.queries,
        ...options?.defaultOptions?.queries,
      },
      mutations: {
        ...defaultQueryClientConfig.defaultOptions?.mutations,
        ...options?.defaultOptions?.mutations,
      },
    },
  });
}

// =============================================================================
// TestProviders Component
// =============================================================================

/**
 * Wraps components with all required providers for testing.
 *
 * Provides:
 * - QueryClientProvider with test-friendly defaults
 * - StoreProvider with optional initial state
 *
 * @example
 * ```tsx
 * const { getByText } = render(
 *   <TestProviders initialState={{ activeProjectId: 'test' }}>
 *     <MyComponent />
 *   </TestProviders>
 * );
 * ```
 */
export function TestProviders({
  children,
  initialState,
  queryClientOptions,
  queryClient: externalQueryClient,
}: TestProvidersProps): React.ReactElement {
  // Create a stable QueryClient instance for the test lifecycle
  const queryClient = useMemo(() => {
    if (externalQueryClient) {
      return externalQueryClient;
    }
    return createTestQueryClient(queryClientOptions);
  }, [externalQueryClient, queryClientOptions]);

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider initialState={initialState}>
        <TooltipProvider>{children}</TooltipProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}

// =============================================================================
// Utility Exports
// =============================================================================

export { defaultQueryClientConfig };
