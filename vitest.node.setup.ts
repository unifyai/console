import { beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, passthrough } from 'msw';
import { handlers } from '@/tests/handlers';

process.env.NEXTAUTH_URL = "http://localhost:3000";
const server = setupServer(...handlers);

// === Test Callbacks ===
beforeAll(() => {
    vi.clearAllMocks();
    server.listen({ onUnhandledRequest: 'bypass' });
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