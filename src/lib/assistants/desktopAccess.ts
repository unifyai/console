import { getCurrentUser } from '@/lib/user/user';
import { parseOrgCallSession } from '@/types/orgChat';
import { assistantField, readableAssistantRow } from '@/lib/assistants/assistantAccess';

/**
 * Who may resolve an assistant's desktop liveview.
 *
 * Opening the desktop to a room call means people other than the assistant's
 * owner need the liveview URL, so the resolvers can no longer hand it to any
 * caller that asks. Two things are decided here:
 *
 *  - **Entitlement.** The owner always qualifies. So does anyone sharing a live
 *    call with the assistant, and anyone Orchestra will show that assistant to —
 *    the same question the shell asks to draw its roster, so a teammate visible
 *    in the UI has a visible desktop. Both are resolved against Orchestra with
 *    the *caller's own* API key, so they report the caller's real scope and
 *    cannot be widened by asking differently.
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
 * Whether Orchestra will show this assistant to the caller.
 *
 * `assistantId` and `ownerId` reach the resolvers as independent client-supplied
 * arguments, and `ownerId` goes on to address a startup row and resolve an owner
 * key. The row Orchestra returns is the authority on which owner an assistant
 * actually has, so a pair that disagrees with it is refused rather than
 * resolved.
 */
async function callerMayReadAssistant(
  apiKey: string,
  assistantId: string,
  ownerId: string
): Promise<boolean> {
  const row = await readableAssistantRow(apiKey, assistantId);
  return row !== null && assistantField(row, 'user_id', 'userId') === ownerId;
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
  if (await callerMayReadAssistant(caller.apiKey, assistantId, ownerId)) {
    return { allowed: true, isOwner: false };
  }
  return {
    allowed: false,
    detail: "You do not have access to this teammate's desktop.",
  };
}
