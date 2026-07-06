/**
 * Client-side Slack integration helpers.
 *
 * Slack install state and revoke flow are driven by the server
 * actions bound on the Organizations page; this module only owns the
 * **OAuth start** dance, which has to round-trip through a Next.js
 * API route so we can set the state cookie via ``next/headers``
 * (cookies can't be set from a client component).
 */

import type { SlackInstallOwner, SlackOAuthStartResponse } from '@/types/slack/install';

/**
 * Ask Console to mint a Slack authorize URL for the given owner (org
 * or personal user). The route signs an owner-scoped state JWT, sets
 * the matching nonce cookie, and returns the URL the browser should
 * navigate to. The caller should open the URL in a new tab — the
 * cookie won't be available until after this fetch resolves.
 */
export async function startSlackOAuth(args: {
  owner: SlackInstallOwner;
  redirectAfter: string;
}): Promise<SlackOAuthStartResponse> {
  const res = await fetch('/api/slack/oauth/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Failed to start Slack OAuth (HTTP ${res.status}).`);
  }
  return (await res.json()) as SlackOAuthStartResponse;
}
