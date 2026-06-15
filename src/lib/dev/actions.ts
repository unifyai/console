'use server';

/**
 * Dev-only server actions for switching between seeded user accounts.
 *
 * These actions are completely inert in production:
 * - `NODE_ENV` is inlined at build time by Next.js — in production builds
 *   the guards short-circuit and the code is dead-code-eliminated.
 * - Only accepts emails matching the `seed-` prefix as an extra safeguard.
 *
 * User discovery is dynamic: `getDevUsers()` queries the local Orchestra
 * database for all users whose email starts with `seed-`, so only users
 * that *actually exist* in the current DB are shown — regardless of which
 * seed scenario was run.
 */

import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { snakeToCamelObject } from '@/utils/casing';
import { execSync } from 'child_process';

import { isSelfHost } from '@/lib/environment/environment';

// ── Cookie constants (mirrors options.tsx) ───────────────────────────────────

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const cookieName = `${cookiePrefix}next-auth.session-token`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface DevUser {
  email: string;
  label: string;
  name: string;
  userId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

// ── Server actions ───────────────────────────────────────────────────────────

/**
 * Discovers seeded dev users by querying the local Orchestra database.
 *
 * Looks for all users whose email matches the `seed-*` pattern (the prefix
 * used by {@link src/tests/seeds/client.ts#uniqueEmail}). For each user it
 * also resolves their organization role (if any) so the quick-login panel
 * can display a meaningful label (owner, admin, member, viewer, or user).
 *
 * Returns an empty array in production or if the database is unreachable.
 */
export async function getDevUsers(): Promise<DevUser[]> {
  if (!isDev() || isSelfHost()) return [];

  try {
    const dbContainer = process.env.ORCHESTRA_DB_CONTAINER || 'orchestra-local-db';

    // Single query: get all seed-* users with their org role (if any).
    // DISTINCT ON ensures one row per user even if they belong to multiple orgs.
    const sql = `
      SELECT DISTINCT ON (u.id)
             u.id,
             u.email,
             u.name,
             u.last_name,
             COALESCE(LOWER(r.name), 'user') AS role_label
        FROM "user" u
        LEFT JOIN organization_member om ON om.user_id = u.id
        LEFT JOIN role r ON r.id = om.role_id
       WHERE u.email LIKE 'seed-%'
       ORDER BY u.id, r.name;
    `;

    // Use stdin piping to avoid shell-escaping issues with double-quoted
    // table names (e.g. "user").
    const raw = execSync(`docker exec -i ${dbContainer} psql -U orchestra -d orchestra -tA`, {
      input: sql,
      encoding: 'utf-8',
      timeout: 5_000,
    }).trim();

    if (!raw) return [];

    // psql -tA output: one row per line, fields separated by |
    // Format: id|email|name|last_name|role_label
    const users: DevUser[] = raw
      .split('\n')
      .filter((line) => line.includes('|'))
      .map((line) => {
        const [userId, email, name, lastName, label] = line.split('|');
        return { email, label: label || 'user', name: `${name} ${lastName}`, userId };
      });

    // Sort by role priority so the login panel has a logical order
    const rolePriority: Record<string, number> = {
      owner: 1,
      admin: 2,
      member: 3,
      viewer: 4,
      user: 5,
    };
    users.sort(
      (a, b) =>
        (rolePriority[a.label] ?? 99) - (rolePriority[b.label] ?? 99) ||
        a.email.localeCompare(b.email)
    );

    return users;
  } catch {
    return [];
  }
}

/**
 * Switches the current session to a different seeded user.
 *
 * - Only works in development mode.
 * - Only accepts `seed-*` email addresses.
 * - Mints a fresh NextAuth JWT and sets the session cookie.
 *
 * Returns `{ ok: true }` on success, `{ ok: false, error: string }` on failure.
 */
export async function switchDevUser(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDev() || isSelfHost()) {
    return { ok: false, error: 'Not available in production' };
  }

  // Only allow seed emails
  if (!email.startsWith('seed-')) {
    return { ok: false, error: 'Only seed user emails are allowed' };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false, error: 'JWT_SECRET is not configured' };
  }

  try {
    // Look up the user from Orchestra
    const response = await OrchestraAdminClient.get('/user/by-email', {
      params: { email },
    });

    if (!response.data) {
      return { ok: false, error: `User not found: ${email}` };
    }

    const user = snakeToCamelObject<{
      id: string;
      email: string;
      name: string;
      lastName: string;
      image: string | null;
    }>(response.data as Record<string, unknown>);

    // Build the JWT token payload (matching the shape from options.tsx jwt callback)
    const maxAge = 7 * 24 * 60 * 60; // 7 days
    const token = await encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.image ?? null,
        provider: 'credentials',
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      maxAge,
    });

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: useSecureCookies,
      maxAge,
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to switch user: ${message}` };
  }
}
