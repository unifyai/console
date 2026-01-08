import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextUIProvider } from '@nextui-org/react';
import { SidebarProvider } from '@/components/UI/sidebar';
import { ThemeProvider } from 'next-themes';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from 'sonner';

// Create a client that doesn't retry on failure for tests
const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const TestProviders = ({ children }: { children: React.ReactNode }) => {
  // Mirrors the Providers tree in src/components/Pages/Providers/Base.tsx, excluding the SessionProvider
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={testQueryClient}>
        <NextUIProvider>
          <SidebarProvider>
            <main className="relative top-10 h-[calc(100vh-2.5rem)] overflow-hidden">
              <NuqsAdapter>
                {children}
                <Toaster richColors position="bottom-right" />
              </NuqsAdapter>
            </main>
          </SidebarProvider>
        </NextUIProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: TestProviders, ...options });

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override the render method
export { customRender as render };
