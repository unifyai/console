/**
 * Shared helpers for Playwright E2E tests.
 *
 * Provides seed-based user creation, login helpers, DB manipulation,
 * and a TOTP generator for MFA tests — all using Node builtins.
 *
 * These helpers call the seed infrastructure directly (not the UI)
 * for fast test setup and teardown.
 */

import { createHash, createHmac } from 'crypto';
import {
  createUser,
  createEmailLogin,
  deleteUser,
  dbExec,
  uniqueEmail,
  type CreateUserOpts,
} from './seeds/client';
import type { SeededUser } from './seeds/types';

// =============================================================================
// User lifecycle
// =============================================================================

export interface TestUser extends SeededUser {
  password: string;
}

const DEFAULT_PASSWORD = 'TestP@ss123';

/**
 * Create a test user with email login ready for Playwright tests.
 * Returns the user with the password so tests can log in via the UI.
 */
export function createTestUser(opts: CreateUserOpts & { password?: string } = {}): TestUser {
  const user = createUser(opts);
  const password = opts.password ?? DEFAULT_PASSWORD;
  createEmailLogin({ userId: user.id, password });
  return { ...user, password };
}

/**
 * Clean up a test user. Call in afterAll/afterEach.
 */
export function cleanupUser(userId: string): void {
  try {
    deleteUser(userId);
  } catch {
    // Best effort — user may already be deleted
  }
}

// =============================================================================
// DB helpers
// =============================================================================

/**
 * Overwrite the verification code hash in the DB with a known value.
 * Returns the plain-text code that matches the hash.
 */
export function setKnownVerificationCode(email: string, purpose = 'signup'): string {
  const knownCode = '123456';
  const hash = createHash('sha256').update(knownCode).digest('hex');
  const normEmail = email.toLowerCase().trim();
  dbExec(
    `UPDATE email_verification SET code_hash = '${hash}', attempts = 0 ` +
      `WHERE email = '${normEmail}' AND purpose = '${purpose}'`
  );
  return knownCode;
}

/**
 * Set a user's credit balance directly in the DB.
 */
export function setUserCredits(userId: string, credits: number): void {
  dbExec(
    `UPDATE billing_account SET credits = ${credits} ` +
      `WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
}

/**
 * Link an OAuth provider (e.g. "google") to a user WITHOUT adding email login.
 * This creates a user who can only be authenticated via that provider,
 * causing provider conflict errors when email login is attempted.
 */
export function linkOAuthProvider(
  userId: string,
  provider: string,
  providerAccountId?: string
): void {
  const accountId = providerAccountId ?? `${provider}-${userId}`;
  dbExec(
    `INSERT INTO account (id, user_id, provider, provider_type, provider_account_id) ` +
      `VALUES ('${accountId}', '${userId}', '${provider}', 'oauth', '${accountId}') ` +
      `ON CONFLICT DO NOTHING`
  );
}

/**
 * Create a test user linked ONLY to an OAuth provider (no email/password).
 * Attempting email login or registration with this user's email should
 * trigger a provider-conflict error.
 */
export function createOAuthOnlyUser(
  opts: CreateUserOpts & { provider?: string } = {}
): SeededUser & { provider: string } {
  const user = createUser(opts);
  const provider = opts.provider ?? 'google';
  linkOAuthProvider(user.id, provider);
  return { ...user, provider };
}

// =============================================================================
// TOTP generator (Node builtins only)
// =============================================================================

/**
 * Tracks the last TOTP counter used per secret so callers can avoid
 * replay-protection rejections without always waiting a full 30-second window.
 */
const lastTotpCounter = new Map<string, number>();

/** Current TOTP counter value for the default 30-second step. */
export function currentTotpCounter(timeStep = 30): number {
  return Math.floor(Date.now() / 1000 / timeStep);
}

/**
 * Whether the current TOTP window for `secret` has already been consumed.
 * Returns false when no prior usage is recorded or when the counter has
 * naturally advanced past the last-used value.
 */
export function needsFreshTotpWindow(secret: string): boolean {
  const last = lastTotpCounter.get(secret);
  return last !== undefined && currentTotpCounter() <= last;
}

/**
 * Generate a 6-digit TOTP code from a base32-encoded secret.
 * Implements RFC 6238 using Node's built-in crypto module.
 *
 * Automatically records the counter so that {@link needsFreshTotpWindow}
 * can detect replay conflicts.
 */
export function generateTOTP(base32Secret: string, timeStep = 30): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);

  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);

  const hmac = createHmac('sha1', key);
  hmac.update(buf);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  lastTotpCounter.set(base32Secret, counter);
  return String(code % 1_000_000).padStart(6, '0');
}

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/[= ]/g, '').toUpperCase();
  let bits = '';
  for (const c of cleaned) {
    const val = BASE32_CHARS.indexOf(c);
    if (val === -1) throw new Error(`Invalid base32 character: ${c}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}
