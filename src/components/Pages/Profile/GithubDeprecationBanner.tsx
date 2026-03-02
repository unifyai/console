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
      className="flex items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950"
      data-testid="github-deprecation-banner"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-sm text-amber-800 dark:text-amber-200">
        <span className="font-medium">GitHub sign-in is being retired</span>
        {' — '}
        Please link your account to Google or{' '}
        <a href="/profile?tab=security" className="font-medium underline underline-offset-2">
          set a password
        </a>{' '}
        to keep access.
      </p>
    </div>
  );
}

