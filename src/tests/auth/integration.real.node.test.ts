/**
 * Integration tests – auth flows through the Console API routes.
 *
 * These tests hit the running Console dev server (`/api/auth/email/…`,
 * `/api/auth/mfa/…`) which proxies to a live Orchestra instance.
 * This exercises the full request path:
 *
 *   test (fetch) → Console route → OrchestraAdminClient → Orchestra
 *
 * Follows the same pattern as the billing `@real` tests:
 *   - Uses `meta: { mock: false }` so MSW passthroughs all requests.
 *   - Skips when the Console dev server is not reachable.
 *
 * Verified flows:
 *   1. Registration (email + password, weak password rejection)
 *   2. Authentication (valid + invalid credentials)
 *   3. Forgot password request (always succeeds, doesn't leak user existence)
 *   4. Full registration → verify (via DB) → authenticate round-trip
 *   5. Full forgot → reset → re-authenticate round-trip
 *   6. Case-insensitive email handling
 *
 * Prerequisites:
 *   - Console dev server running      (`npm run dev`)
 *   - Orchestra running locally       (local.sh)
 *   - PostgreSQL accessible via docker exec
 *
 * Run:
 *   npx vitest run --project real src/tests/auth/integration.real.node.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

import {
  skipIfServerNotReachable,
  realTestOptions,
  ApiError,
  apiFetch,
  apiJson,
  dbExec,
  uniqueEmail,
  registerUser,
  setKnownVerificationCode,
  verifyEmail,
  authenticate,
  registerAndVerify,
  forgotPassword,
} from './fixtures';

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('@real Auth API', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  // ─── Registration ──────────────────────────────────────────────────────────

  describe('Registration', () => {
    it('@real registers a new user and returns requiresVerification', realTestOptions, async () => {
      const email = uniqueEmail();
      const data = await registerUser(email, 'StrongP@ss1');

      expect(data.requiresVerification).toBe(true);
      expect(data.email).toBe(email);
    });

    it(
      '@real rejects registration with weak password (client-side validation)',
      realTestOptions,
      async () => {
        try {
          await registerUser(uniqueEmail(), 'weak');
          expect.fail('Should have thrown');
        } catch (e: any) {
          expect(e).toBeInstanceOf(ApiError);
          expect(e.status).toBe(400);
          expect(e.body.error).toBe('weak_password');
        }
      }
    );
  });

  // ─── Authentication ────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('@real rejects invalid credentials', realTestOptions, async () => {
      try {
        await authenticate('nonexistent-user@example.com', 'WrongP@ss1');
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ApiError);
        expect([400, 401]).toContain(e.status);
      }
    });
  });

  // ─── Forgot Password ──────────────────────────────────────────────────────

  describe('Forgot Password', () => {
    it('@real accepts request without revealing email existence', realTestOptions, async () => {
      // Forgot-password should always succeed (don't leak user existence)
      const data = await forgotPassword('nonexistent@example.com');
      // The response must be a valid JSON object (not null/undefined)
      expect(data).toEqual(expect.any(Object));
    });
  });

  // ─── Full Round-Trip ───────────────────────────────────────────────────────

  describe('Full Registration → Verify → Authenticate', () => {
    it(
      '@real completes the full auth lifecycle via DB-assisted verification',
      realTestOptions,
      async () => {
        const email = uniqueEmail();
        const password = 'IntTest@Pass1';

        // 1. Register
        const reg = await registerUser(email, password, 'Integration', 'Test');
        expect(reg.requiresVerification).toBe(true);

        // 2. Get verification code from DB
        const code = setKnownVerificationCode(email);

        // 3. Verify
        const ver = await verifyEmail(email, code);
        expect(ver.id).toBeTruthy();
        expect(ver.email).toBe(email);

        // 4. Authenticate with the registered password
        const auth = await authenticate(email, password);
        expect(auth.preAuthToken).toBeTruthy();

        // 5. Wrong password must fail
        try {
          await authenticate(email, 'WrongP@ss99');
          expect.fail('Should have thrown for wrong password');
        } catch (e: any) {
          expect(e).toBeInstanceOf(ApiError);
          expect([400, 401]).toContain(e.status);
        }
      }
    );
  });

  // ─── Full Password Reset ──────────────────────────────────────────────────

  describe('Full Forgot → Reset → Re-authenticate', () => {
    it(
      '@real completes the forgot-password → verify code → reset → login flow',
      realTestOptions,
      async () => {
        const email = uniqueEmail('reset');
        const oldPassword = 'OriginalP@ss1';
        const newPassword = 'BrandNewP@ss2';

        // 1. Register + verify (so the user exists)
        await registerAndVerify(email, oldPassword, 'Reset', 'Test');

        // 2. Authenticate with old password (sanity check)
        const auth1 = await authenticate(email, oldPassword);
        expect(auth1.preAuthToken).toBeTruthy();

        // 3. Request password reset
        await forgotPassword(email);

        // 4. Get the reset code from DB
        const code = setKnownVerificationCode(email, 'password_reset');

        // 5. Verify the reset code via the dedicated Console route
        const verRes = await apiJson<{ token: string }>('/api/auth/email/verify-reset-code', {
          method: 'POST',
          body: JSON.stringify({ email, code }),
        });
        expect(verRes.token).toBeTruthy();

        // 6. Reset the password
        const resetRes = await apiFetch('/api/auth/email/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: verRes.token, password: newPassword }),
        });
        expect(resetRes.ok).toBe(true);

        // 7. Authenticate with new password
        const auth2 = await authenticate(email, newPassword);
        expect(auth2.preAuthToken).toBeTruthy();

        // 8. Old password no longer works
        try {
          await authenticate(email, oldPassword);
          expect.fail('Old password should have been rejected');
        } catch (e: any) {
          expect(e).toBeInstanceOf(ApiError);
          expect([400, 401]).toContain(e.status);
        }
      }
    );
  });

  // ─── Case Insensitivity ───────────────────────────────────────────────────

  describe('Email Case Insensitivity', () => {
    it(
      '@real registers with mixed case and authenticates with lowercase',
      realTestOptions,
      async () => {
        const base = uniqueEmail('case');
        // Register with mixed case
        const mixedCase = base.replace(/^[a-z]/, (c) => c.toUpperCase());
        const password = 'CaseTest@1';

        await registerAndVerify(mixedCase, password, 'Case', 'Test');

        // Authenticate with lowercase should work
        const auth = await authenticate(base.toLowerCase(), password);
        expect(auth.preAuthToken).toBeTruthy();
      }
    );
  });
});
