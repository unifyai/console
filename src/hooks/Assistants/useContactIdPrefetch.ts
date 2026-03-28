import * as React from 'react';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage, Attachment } from '@/types/assistants/chat';
import { ResponseProps } from '@/types/common';
import { clientLog } from '@/lib/logging/client-log-buffer';
import {
  buildUserIdFilter,
  buildAssistantIdFilter,
  combineFilters,
} from '@/utils/assistants/filterExpressions';

const CONTACT_ID_SESSION_PREFIX = 'assistant_contact_id:';
const TRANSCRIPT_LIMIT = 50;

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

// ── In-flight transcript deduplication ────────────────────────────────
// Mirrors inflightContactIds above. The prefetch hook and the chat hook
// both fetch transcripts for the same assistant. Without dedup, when the
// user opens a profile before the prefetch completes, a second identical
// getTranscripts call fires. This map ensures only ONE request is ever
// in-flight per (assistantId, contactId) pair.
const inflightTranscripts = new Map<string, Promise<ChatMessage[] | ResponseProps>>();

/**
 * Returns transcripts, reusing any in-flight request for the same
 * assistant+contactId combination.
 */
export function getOrFetchTranscripts(
  getTranscripts: (
    contactId: number,
    ownerId: string,
    assistantId: string
  ) => Promise<ChatMessage[] | ResponseProps>,
  contactId: number,
  ownerId: string,
  assistantId: string
): Promise<ChatMessage[] | ResponseProps> {
  const key = `${assistantId}:${contactId}`;
  const existing = inflightTranscripts.get(key);
  if (existing) return existing;

  const promise = getTranscripts(contactId, ownerId, assistantId).finally(() => {
    inflightTranscripts.delete(key);
  });

  inflightTranscripts.set(key, promise);
  return promise;
}

// ── Client-side direct fetch helpers ────────────────────────────────────
// getContactId and getTranscripts are `'use server'` functions. Next.js 14
// serializes ALL server action calls from the same page, so the prefetch's
// server action gets queued behind every other POST /assistants call
// (rerenders, balance, spending, etc.) — adding seconds of delay.
//
// These helpers call /api/logs directly via fetch(), which uses session
// cookie auth and bypasses the server action queue entirely.
// They are used ONLY by the prefetch hook; the chat hook continues using
// server actions (which is fine because by the time the user opens the
// chat, the queue is shorter).

async function fetchContactIdDirect(
  email: string,
  ownerId: string,
  assistantId: string
): Promise<number | null> {
  try {
    const emailFilter = `email_address == "${email}"`;
    const securityFilter = combineFilters([
      buildUserIdFilter(ownerId),
      buildAssistantIdFilter(assistantId),
    ]);
    const filterExpr = combineFilters([emailFilter, securityFilter]);
    const params = new URLSearchParams({
      projectName: 'Assistants',
      context: 'All/Contacts',
      filterExpr,
      limit: '1',
    });

    const response = await fetch(`/api/logs?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const data = await response.json();
    const logs = data?.logs;
    if (!Array.isArray(logs) || logs.length === 0) return null;

    const contactId = logs[0]?.entries?.contactId;
    return typeof contactId === 'number' ? contactId : null;
  } catch {
    return null;
  }
}

export async function fetchTranscriptsDirect(
  contactId: number,
  ownerId: string,
  assistantId: string,
  limit: number = TRANSCRIPT_LIMIT
): Promise<ChatMessage[] | ResponseProps> {
  try {
    const messageFilter = `medium == "unify_message" and (sender_id == ${contactId} or (sender_id == 0 and ${contactId} in receiver_ids))`;
    const securityFilter = combineFilters([
      buildUserIdFilter(ownerId),
      buildAssistantIdFilter(assistantId),
    ]);
    const filterExpr = combineFilters([messageFilter, securityFilter]);
    const params = new URLSearchParams({
      projectName: 'Assistants',
      context: 'All/Transcripts',
      limit: String(limit),
      filterExpr,
    });

    const response = await fetch(`/api/logs?${params.toString()}`, {
      cache: 'no-store',
    });

    if (response.status === 404) return [];
    if (!response.ok) {
      return { detail: `Failed with status ${response.status}` };
    }

    const data = await response.json();
    const logs = data?.logs;
    if (!Array.isArray(logs)) return [];

    return logs
      .map((log: Record<string, any>): ChatMessage | null => {
        const entries = log.entries;
        const id = log.id;
        if (
          !entries ||
          typeof entries.content !== 'string' ||
          typeof entries.senderId === 'undefined'
        ) {
          return null;
        }
        return {
          id: String(id),
          role: entries.senderId === 0 ? 'assistant' : 'user',
          content: entries.content,
          timestamp: new Date(entries.timestamp as string),
          messageId: typeof entries.messageId === 'number' ? entries.messageId : undefined,
          attachments: Array.isArray(entries.attachments)
            ? (entries.attachments as Record<string, unknown>[]).map(
                (a): Attachment => ({
                  id: (a.id as string) || String(id),
                  filename: (a.filename as string) || 'attachment',
                  gsUrl: a.gsUrl as string | undefined,
                  contentType: a.contentType as string | undefined,
                  sizeBytes: a.sizeBytes as number | undefined,
                })
              )
            : [],
        };
      })
      .filter((msg: ChatMessage | null): msg is ChatMessage => msg !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { detail: message };
  }
}

/**
 * Prefetches contact IDs **and transcripts** for all loaded assistants in
 * the background, on page load — before the user opens any chat panel.
 *
 * Uses direct fetch() to /api/logs instead of server actions to bypass
 * Next.js 14's server action serialization queue. Server actions on a page
 * are processed sequentially (all POST /assistants calls queue up), which
 * delays the prefetch by seconds. Direct fetch uses session cookie auth
 * and runs concurrently with server actions.
 *
 * Contact IDs are stored in sessionStorage; transcripts are written
 * directly into `chatHistories` (write-if-absent, so the chat hook's own
 * writes always win).
 *
 * When the user eventually opens a chat, the chat hook sees
 * `chatHistories[assistantId] !== undefined` and takes the fast
 * "returning" branch — going straight to `ready` with zero loading state.
 *
 * This hook is fire-and-forget — it never blocks rendering or shows errors.
 */
export function useContactIdPrefetch(
  assistants: Assistant[],
  chatActions: Pick<AssistantActions, 'chat'>,
  userEmail: string | null | undefined,
  setChatHistories?: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>
) {
  // Track which assistants we've already attempted to prefetch
  const attemptedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!userEmail || assistants.length === 0) return;

    // Find assistants we haven't attempted to prefetch yet
    const toProcess = assistants.filter((a) => !attemptedRef.current.has(a.agentId));
    if (toProcess.length === 0) return;

    // Mark as attempted immediately to prevent duplicate fetches
    for (const a of toProcess) {
      attemptedRef.current.add(a.agentId);
    }

    // Resolve contact IDs (and transcripts) using direct fetch().
    // This bypasses the server action serialization queue, so the
    // requests fire immediately instead of waiting behind other
    // POST /assistants calls (rerenders, balance checks, etc.).
    const email = userEmail;
    for (const assistant of toProcess) {
      // Check sessionStorage first — if cached, skip the contact ID fetch
      const cachedId = getSessionContactId(assistant.agentId, email);
      const contactIdPromise =
        cachedId !== undefined
          ? Promise.resolve(cachedId)
          : fetchContactIdDirect(email, assistant.userId, assistant.agentId).then((id) => {
              clientLog('PREFETCH_CONTACT', {
                assistant: assistant.agentId,
                source: id !== null ? 'api' : 'null',
                contactId: id,
              });
              if (id !== null) {
                setSessionContactId(assistant.agentId, id, email);
              }
              return id;
            });

      contactIdPromise
        .then((contactId) => {
          if (contactId === null || !setChatHistories) return;

          return fetchTranscriptsDirect(contactId, assistant.userId, assistant.agentId).then(
            (result) => {
              if ('detail' in result) {
                clientLog('PREFETCH_TRANSCRIPTS', {
                  assistant: assistant.agentId,
                  error: (result as any).detail,
                });
                return;
              }
              const history = [...(result as ChatMessage[])].reverse();
              clientLog('PREFETCH_TRANSCRIPTS', {
                assistant: assistant.agentId,
                count: history.length,
              });
              setChatHistories((prev) => {
                if (prev[assistant.agentId] !== undefined) {
                  clientLog('PREFETCH_SKIP', {
                    assistant: assistant.agentId,
                    reason: 'already_exists',
                  });
                  return prev;
                }
                return { ...prev, [assistant.agentId]: history };
              });
            }
          );
        })
        .catch((err) => {
          clientLog('PREFETCH_ERROR', { assistant: assistant.agentId, error: String(err) });
        });
    }
  }, [assistants, chatActions, userEmail, setChatHistories]);
}
