/**
 * Shared MSW server for node tests
 *
 * This creates the MSW server instance that is shared between
 * the vitest setup file and test files that need to add custom handlers.
 *
 * Usage in tests:
 * ```typescript
 * import { server } from '@/tests/server';
 *
 * beforeEach(() => {
 *   server.use(http.get('/api/foo', () => HttpResponse.json({ ... })));
 * });
 * ```
 */

import { setupServer } from 'msw/node';
import { handlers } from '@/tests/handlers';

export const server = setupServer(...handlers);
