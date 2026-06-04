/**
 * Shared helpers for the staging-environment access gate.
 *
 * Staging is restricted to approved email domains, plus an optional
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

const STAGING_ALLOWED_EMAIL_DOMAINS: ReadonlySet<string> = new Set(['@unify.ai', '@h-iq.co.uk']);

export const IS_STAGING: boolean = process.env.ORCHESTRA_URL?.includes('staging') ?? false;

const STAGING_EMAIL_ALLOWLIST: ReadonlySet<string> = new Set(
  (process.env.STAGING_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

export function isUnifyMember(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith('@unify.ai');
}

export function isStagingAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.includes('@') ? `@${normalizedEmail.split('@').pop()}` : '';

  if (isUnifyMember(email)) return true;
  if (STAGING_ALLOWED_EMAIL_DOMAINS.has(domain)) return true;
  return STAGING_EMAIL_ALLOWLIST.has(normalizedEmail);
}
