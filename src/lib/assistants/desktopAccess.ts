import { getCurrentUser } from '@/lib/user/user';
import { parseOrgCallSession } from '@/types/orgChat';

/**
 * Who may resolve an assistant's desktop liveview.
 *
 * Opening the desktop to a room call means people other than the assistant's
 * owner need the liveview URL, so the resolvers can no longer hand it to any
 * caller that asks. Two things are decided here:
 *
 *  - **Entitlement.** The owner always qualifies. Anyone else qualifies only
 *    while they share a live call with that assistant, which is checked against
 *    Orchestra using the *caller's own* API key — so it reports the caller's
 *    real membership and cannot be widened by asking differently.
 *  - **Which secret may be used.** A per-session `liveview_password` is scoped
 *    to one desktop session and is safe to hand a participant. The fallback is
 *    the owner's own Orchestra API key, which is not: it must never leave the
 *    owner, so a non-owner with no published password gets nothing instead.
 */
export type DesktopViewerGrant =
  | { allowed: true; isOwner: boolean }
  | { allowed: false; detail: string };

/** Live call statuses that count as sharing a call with the assistant. */
const LIVE_CALL_STATUSES = new Set(['ringing', 'active']);

async function callerSharesLiveCallWithAssistant(
  apiKey: string,
  assistantId: string
): Promise<boolean> {
  const orchestraUrl = process.env.ORCHESTRA_URL;
  if (!orchestraUrl) return false;

  // Scoped to the caller by their own key: Orchestra returns only the calls
  // this user is a participant of.
  const response = await fetch(`${orchestraUrl}/v0/calls/active`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  if (!response.ok) return false;

  const data = await response.json().catch(() => null);
  const rawCalls = (data as { calls?: unknown[] } | null)?.calls;
  if (!Array.isArray(rawCalls)) return false;

  const wanted = Number(assistantId);
  return rawCalls.some((raw) => {
    const call = parseOrgCallSession(raw as Record<string, unknown>);
    return LIVE_CALL_STATUSES.has(call.status) && call.assistantIds.includes(wanted);
  });
}

/**
 * Decide whether the current caller may resolve this assistant's liveview.
 *
 * `ownerId` is the assistant's creator / lifecycle owner, as carried by
 * `Assistant.userId`.
 */
export async function resolveDesktopViewerGrant(
  assistantId: string,
  ownerId: string
): Promise<DesktopViewerGrant> {
  const caller = await getCurrentUser();
  if (!caller?.id || !caller.apiKey) {
    return { allowed: false, detail: 'Not signed in.' };
  }
  if (caller.id === ownerId) {
    return { allowed: true, isOwner: true };
  }
  if (await callerSharesLiveCallWithAssistant(caller.apiKey, assistantId)) {
    return { allowed: true, isOwner: false };
  }
  return {
    allowed: false,
    detail: 'You can only view this desktop while you are on a call with this teammate.',
  };
}
