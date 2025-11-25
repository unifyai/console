import React, { ReactElement, Suspense } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextUIProvider } from '@nextui-org/react';
import { SidebarProvider } from '@/components/UI/sidebar';
import { ThemeProvider } from 'next-themes';
import { StoreProvider } from '@/contexts/providers/StoreProvider';
import type { IStoreState } from '@/contexts/store';
// NuqsAdapter removed from here to support unit testing environment
// For browser tests requiring URL sync, wrap the test component manually in NuqsAdapter

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Partial<IStoreState>;
  queryClient?: QueryClient;
}

/**
 * Create a new QueryClient instance for each test.
 * We intentionally do NOT share this between tests to avoid cross-test pollution.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

const InterfacesTestProviders =
  (initialState?: Partial<IStoreState>, providedClient?: QueryClient) =>
  function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = providedClient ?? createTestQueryClient();

    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <NextUIProvider>
            <SidebarProvider>
              <StoreProvider initialState={initialState}>
                <Suspense fallback={null}>
                  <main className="relative top-10 h-[calc(100vh-2.5rem)] overflow-hidden">
                    {children}
                  </main>
                </Suspense>
              </StoreProvider>
            </SidebarProvider>
          </NextUIProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  };

/**
 * Render a component tree wrapped in the Interfaces providers:
 * - ThemeProvider
 * - QueryClientProvider (new client per test, retry: false)
 * - NextUIProvider
 * - SidebarProvider
 * - StoreProvider (fresh Zustand store per test, optional initialState)
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const { initialState, queryClient, ...rest } = options;

  return render(ui, {
    wrapper: InterfacesTestProviders(initialState, queryClient),
    ...rest,
  });
}
// Re-export all Testing Library helpers (screen, waitFor, etc.)
export * from '@testing-library/react';
// Alias to match the common RTL API used in tests (wrapped with providers)
export { renderWithProviders as render };

/**
 * Helper function to create a wrapper for renderHook
 * This simplifies testing custom hooks that need the query client context
 */
export const createQueryWrapper = () => {
  const queryClient = createTestQueryClient();
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

