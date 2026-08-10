/**
 * Shared helpers for the staging-environment access gate.
 *
 * Staging is restricted to @unify.ai email addresses, plus an optional
 * per-address allowlist (e.g. founder personal Gmails or stress-test
 * accounts) sourced from STAGING_EMAIL_ALLOWLIST (comma-separated).
 *
 * Used by:
 *  - NextAuth signIn / jwt callbacks (src/app/api/auth/[...nextauth]/options.tsx)
 *  - Email-register API route (src/app/api/auth/email/register/route.ts)
 *  - Next.js middleware (src/middleware.ts)
 *
 * Mirrors orchestra/orchestra/web/api/dependencies.py — keep both in sync.
 */

import { resolveEnvironment } from '@/lib/environment/environment';

import { isUnifyStaff } from '@/lib/auth/unify-staff';

/** Whether this deployment is hosted staging (see `resolveEnvironment`). */
export const IS_STAGING: boolean = resolveEnvironment().isStaging;

const STAGING_EMAIL_ALLOWLIST: ReadonlySet<string> = new Set(
  (process.env.STAGING_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

export function isStagingAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isUnifyStaff(email)) return true;
  return STAGING_EMAIL_ALLOWLIST.has(email.trim().toLowerCase());
}
