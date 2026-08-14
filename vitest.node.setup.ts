import { beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, passthrough } from 'msw';
import { server } from '@/tests/server';
import '@testing-library/jest-dom/vitest';

// CI's test setup (scripts/ci-test-setup.sh) exports ORCHESTRA_ADMIN_KEY before
// running vitest; default it here so admin-gated routes exercised by node tests
// do not 500 on machines without it. Mirrors the requireAdminKey mock below.
process.env.ORCHESTRA_ADMIN_KEY ||= 'test-admin-key';

/**
 * Node >= 22 defines localStorage/sessionStorage on globalThis, so the jsdom
 * environment leaves Node's versions in place — and without --localstorage-file
 * Node's localStorage getter yields undefined. Install an in-memory Storage so
 * tests see the same working storage that jsdom provides under CI's Node 20.
 */
class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(String(key)) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(String(key));
  }
  setItem(key: string, value: string): void {
    this.data.set(String(key), String(value));
  }
}

if (typeof window !== 'undefined' && !window.localStorage) {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}

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
