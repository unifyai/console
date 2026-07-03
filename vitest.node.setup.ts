import { beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, passthrough } from 'msw';
import { server } from '@/tests/server';
import '@testing-library/jest-dom/vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

vi.mock('@/lib/server-action-session', () => ({
  requireUserApiKey: async () => process.env.VITE_TEST_API_KEY || 'test-api-key-12345',
  requireAdminKey: async () => process.env.ORCHESTRA_ADMIN_KEY || 'test-admin-key',
  resolveSecretSession: async () => ({
    apiKey: process.env.VITE_TEST_API_KEY || 'test-api-key-12345',
    orgId: null,
    orgName: null,
  }),
}));

// === Test Callbacks ===
beforeAll(() => {
  vi.clearAllMocks();
  server.listen({ onUnhandledRequest: 'bypass' });

  // Provide a basic matchMedia polyfill for libraries like next-themes
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  }
});

beforeEach(async (context) => {
  const shouldMock = context.task.meta?.mock ?? true;
  if (server && shouldMock === false) {
    server.use(
      http.all('*', () => {
        return passthrough();
      })
    );
  }
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
