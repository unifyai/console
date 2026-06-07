'use client';

import { useSession } from 'next-auth/react';
import { AlertTriangle } from 'lucide-react';

/**
 * GithubDeprecationBanner — full-width warning shown at the top of the
 * Profile page when the current session was authenticated via GitHub.
 *
 * Follows the same visual pattern as AssistantsBanners (border-b, centered
 * text, amber/orange colour scheme).
 *
 * The banner disappears automatically once the user signs in with a
 * different provider (Google or email/password).
 */
export function GithubDeprecationBanner() {
  const { data: session } = useSession();

  if (session?.provider !== 'github') return null;

  return (
    <div
      className="border-[color:var(--status-warning)]/25 flex items-center justify-center gap-3 border-b bg-[color:var(--status-warning-bg)] px-4 py-2.5"
      data-testid="github-deprecation-banner"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[color:var(--status-warning)]" />
      <p className="text-body text-[color:var(--status-warning)]">
        <span className="font-medium">GitHub sign-in is being retired</span>
        {' — '}
        Please sign in with another provider or{' '}
        <a href="/account?tab=security" className="font-medium underline underline-offset-2">
          set a password
        </a>{' '}
        to keep access.
      </p>
    </div>
  );
}
