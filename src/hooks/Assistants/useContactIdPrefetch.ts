import * as React from 'react';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';

const CONTACT_ID_SESSION_PREFIX = "assistant_contact_id:";

// ── sessionStorage-backed contact ID cache ──────────────────────────────
// contact_id is an immutable auto-incrementing integer, so it's safe to
// cache across the browser session. This eliminates the "Connecting..."
// flash on page refreshes and when switching between assistants.
export function getSessionContactId(assistantId: string, email?: string): number | undefined {
  // The key must include the user's email so that different org members
  // (or different accounts in the same browser tab after sign-out/sign-in)
  // never read each other's cached contact IDs.
  const key = email
    ? `${CONTACT_ID_SESSION_PREFIX}${email}:${assistantId}`
    : `${CONTACT_ID_SESSION_PREFIX}${assistantId}`;
  try {
    const val = sessionStorage.getItem(key);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // sessionStorage unavailable (e.g. SSR, privacy mode)
  }
  return undefined;
}

export function setSessionContactId(assistantId: string, id: number, email?: string): void {
  const key = email
    ? `${CONTACT_ID_SESSION_PREFIX}${email}:${assistantId}`
    : `${CONTACT_ID_SESSION_PREFIX}${assistantId}`;
  try {
    sessionStorage.setItem(key, String(id));
  } catch {
    // sessionStorage unavailable
  }
}

// ── In-flight request deduplication ─────────────────────────────────────
// The prefetch hook and the chat hook both resolve contact IDs. Without
// deduplication, opening a profile before the prefetch completes fires a
// redundant API call that races (and often finishes slower) than the
// prefetch. This map ensures only ONE network request is ever in-flight
// per (assistantId, email) pair — subsequent callers piggyback on the
// existing promise.
const inflightContactIds = new Map<string, Promise<number | null>>();

/**
 * Returns a contact ID, reusing any in-flight request for the same
 * assistant+email combination. Results are written to sessionStorage
 * so future calls resolve instantly.
 */
export function getOrFetchContactId(
  getContactId: (email: string, ownerId: string, assistantId: string) => Promise<number | null>,
  email: string,
  ownerId: string,
  assistantId: string
): Promise<number | null> {
  // Fast path: already in sessionStorage (scoped to this user)
  const cached = getSessionContactId(assistantId, email);
  if (cached !== undefined) return Promise.resolve(cached);

  // Reuse an in-flight request if one exists
  const key = `${assistantId}:${email}`;
  const existing = inflightContactIds.get(key);
  if (existing) return existing;

  // Start a new request and register it
  const promise = getContactId(email, ownerId, assistantId)
    .then((id) => {
      if (id !== null) {
        setSessionContactId(assistantId, id, email);
      }
      return id;
    })
    .finally(() => {
      inflightContactIds.delete(key);
    });

  inflightContactIds.set(key, promise);
  return promise;
}

/**
 * Prefetches contact IDs for all loaded assistants in the background.
 *
 * Results are stored in sessionStorage so they're immediately available
 * when the user opens a chat, eliminating the "Connecting..." delay for
 * subsequent interactions within the same browser session.
 *
 * This hook is fire-and-forget — it never blocks rendering or shows errors.
 * The chat hook (`useAssistantProfileChat`) reads from the same sessionStorage
 * key on init, so the two hooks communicate without prop-threading.
 */
export function useContactIdPrefetch(
  assistants: Assistant[],
  chatActions: Pick<AssistantActions, 'chat'>,
  userEmail: string | null | undefined
) {
  // Track which assistants we've already attempted to prefetch
  const attemptedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!userEmail || assistants.length === 0) return;

    // Find assistants we haven't attempted to prefetch yet
    const toPrefetch = assistants.filter((a) => {
      if (attemptedRef.current.has(a.agentId)) return false;
      // Already in sessionStorage — no need to fetch
      if (getSessionContactId(a.agentId, userEmail) !== undefined) {
        attemptedRef.current.add(a.agentId);
        return false;
      }
      return true;
    });

    if (toPrefetch.length === 0) return;

    // Mark as attempted immediately to prevent duplicate fetches
    for (const a of toPrefetch) {
      attemptedRef.current.add(a.agentId);
    }

    // Resolve all in parallel (typically 1-10 assistants).
    // Uses getOrFetchContactId so the chat hook can piggyback on these
    // in-flight requests instead of firing redundant API calls.
    for (const assistant of toPrefetch) {
      getOrFetchContactId(
        chatActions.chat.getContactId,
        userEmail,
        assistant.userId,
        assistant.agentId
      ).catch(() => {
        // Silently ignore — the chat hook will resolve on demand
      });
    }
  }, [assistants, chatActions, userEmail]);
}

