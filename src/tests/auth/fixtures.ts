/**
 * Shared helpers for auth tests.
 *
 * Provides:
 * - mockWindowLocation: Stubs window.location for JSDOM tests
 * - Auth-specific API helpers for real integration tests
 * - DB helpers for test setup (verification codes, etc.)
 *
 * NOTE: vi.mock() calls CANNOT be shared across test files due to Vitest's
 * hoisting semantics — each vi.mock() is lifted above imports and scoped to
 * the file it appears in.  This file therefore only contains non-mock helpers.
 */

import { vi } from 'vitest';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import {
  ApiError,
  skipIfServerNotReachable,
  realTestOptions,
} from '@/tests/assistants/api/fixtures/api-actions';

// ─── Re-exports (convenience) ───────────────────────────────────────────────

export { ApiError, skipIfServerNotReachable, realTestOptions };

// ─── Environment ────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const DB_CONTAINER = process.env.ORCHESTRA_DB_CONTAINER || 'orchestra-local-db';

const API_TIMEOUT = 30_000;

// ─── Component-test Helpers ─────────────────────────────────────────────────

/**
 * Stub `window.location` for JSDOM-based component tests.
 *
 * Call once in `beforeEach`; the property is set with `writable: true` so
 * subsequent calls in the same test or `afterEach` cleanups work correctly.
 *
 * @param pathname  URL path (default `/login`)
 * @param search    Query string including the leading `?` (default `''`)
 */
export function mockWindowLocation(pathname = '/login', search = '') {
  Object.defineProperty(window, 'location', {
    value: {
      href: `http://localhost:3000${pathname}${search}`,
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname,
      search,
      hash: '',
      assign: vi.fn(),
      replace: vi.fn(),
    },
    writable: true,
  });
}

// ─── Real Integration Helpers ───────────────────────────────────────────────

/**
 * Fetch wrapper with timeout for integration tests against the Console dev server.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    return await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Fetch and parse JSON, throwing an ApiError on non-2xx responses.
 */
export async function apiJson<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(endpoint, options);
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/**
 * Run a SQL query against the local Orchestra DB and return trimmed output.
 */
export function dbExec(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U orchestra -d orchestra -tAc "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', timeout: 5_000 },
  ).trim();
}

/**
 * Generate a unique test email to avoid cross-run collisions.
 */
export function uniqueEmail(prefix = 'auth-integ'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

// ─── E2E Flow Helpers ───────────────────────────────────────────────────────

/**
 * Register a new user via the Console API route.
 */
export async function registerUser(
  email: string,
  password: string,
  name = 'Test',
  lastName = 'User',
) {
  return apiJson<{ email: string; requiresVerification: boolean }>(
    '/api/auth/email/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, name, lastName }),
    },
  );
}

/**
 * Overwrite the verification code hash in the DB with a known value and
 * return the corresponding plain-text code.
 *
 * Orchestra stores codes as SHA-256 hashes, so we can't read them back.
 * Instead we set a known hash and return the matching code.
 */
export function setKnownVerificationCode(email: string, purpose = 'signup'): string {
  const knownCode = '123456';
  const hash = createHash('sha256').update(knownCode).digest('hex');
  // Orchestra normalises emails to lowercase
  const normEmail = email.toLowerCase().trim();
  dbExec(
    `UPDATE email_verification SET code_hash = '${hash}', attempts = 0 WHERE email = '${normEmail}' AND purpose = '${purpose}'`,
  );
  return knownCode;
}

/**
 * Verify a user's email code via the Console API route.
 */
export async function verifyEmail(email: string, code: string, purpose = 'signup') {
  return apiJson<{ id: string; email: string }>(
    '/api/auth/email/verify',
    {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose }),
    },
  );
}

/**
 * Authenticate via the Console API route.
 */
export async function authenticate(email: string, password: string) {
  return apiJson<{ id: string; email: string; preAuthToken: string; mfa_required?: boolean }>(
    '/api/auth/email/authenticate',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
}

/**
 * Full register → verify → authenticate round-trip.
 * Returns the authenticated user data.
 */
export async function registerAndVerify(
  email: string,
  password: string,
  name = 'Test',
  lastName = 'User',
) {
  await registerUser(email, password, name, lastName);
  const code = setKnownVerificationCode(email);
  const user = await verifyEmail(email, code);
  return user;
}

/**
 * Request a forgot-password email via the Console API route.
 */
export async function forgotPassword(email: string) {
  return apiJson<Record<string, unknown>>(
    '/api/auth/email/forgot-password',
    {
      method: 'POST',
      body: JSON.stringify({ email, captchaToken: 'test' }),
    },
  );
}

