import * as React from 'react';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage, Attachment, CallPill } from '@/types/assistants/chat';
import { ResponseProps } from '@/types/common';
import { clientLog } from '@/lib/logging/client-log-buffer';
import { mergeRootRows } from '@/lib/client/read_across_roots';
import {
  contactScopedRootQueries,
  meetExchangeFilterForRoot,
  roleFromRootSenderId,
  rootContext,
  transcriptFilterForRoot,
} from '@/lib/assistants/scope';
import { transcriptMergeDedupeKey } from '@/lib/assistants/transcriptDedupe';

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
    if (email && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('owner-contact-id-updated', { detail: { email } }));
    }
  } catch {
    // sessionStorage unavailable
  }
}

/** First cached contact id for this user (profile switcher avatar tone). */
export function getAnySessionContactIdForUser(email: string): number | undefined {
  const prefix = `${CONTACT_ID_SESSION_PREFIX}${email}:`;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const val = sessionStorage.getItem(key);
      if (val === null) continue;
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // sessionStorage unavailable
  }
  return undefined;
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
  getContactId: (email: string, assistant: Assistant) => Promise<number | null>,
  email: string,
  assistant: Assistant
): Promise<number | null> {
  const assistantId = assistant.agentId;
  // Fast path: already in sessionStorage (scoped to this user)
  const cached = getSessionContactId(assistantId, email);
  if (cached !== undefined) return Promise.resolve(cached);

  // Reuse an in-flight request if one exists
  const key = `${assistantId}:${email}`;
  const existing = inflightContactIds.get(key);
  if (existing) return existing;

  // Start a new request and register it
  const promise = getContactId(email, assistant)
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
    assistant: Assistant,
    before?: { timestamp: string; excludedKeys?: string[] }
  ) => Promise<ChatMessage[] | ResponseProps>,
  contactId: number,
  assistant: Assistant
): Promise<ChatMessage[] | ResponseProps> {
  const assistantId = assistant.agentId;
  const key = `${assistantId}:${contactId}`;
  const existing = inflightTranscripts.get(key);
  if (existing) return existing;

  const promise = getTranscripts(contactId, assistant).finally(() => {
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

async function fetchContactIdDirect(email: string, assistant: Assistant): Promise<number | null> {
  try {
    const filterExpr = `email_address == "${email}"`;
    const params = new URLSearchParams({
      projectName: 'Assistants',
      context: rootContext({ kind: 'personal' }, assistant.userId, assistant.agentId, 'Contacts'),
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
  assistant: Assistant,
  limit: number = TRANSCRIPT_LIMIT
): Promise<ChatMessage[] | ResponseProps> {
  try {
    const queries = contactScopedRootQueries(assistant, contactId, 'Transcripts');
    const rootLogs = await Promise.all(
      queries.map(async (query) => {
        const filterExpr = transcriptFilterForRoot(query, assistant.agentId);
        const params = new URLSearchParams({
          projectName: 'Assistants',
          context: query.context,
          limit: String(limit),
          filterExpr,
          sorting: JSON.stringify({ timestamp: 'descending' }),
        });

        const response = await fetch(`/api/logs?${params.toString()}`, {
          cache: 'no-store',
        });

        if (response.status === 404) return [];
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }

        const data = await response.json();
        const rootLogs = data?.logs;
        return Array.isArray(rootLogs) ? rootLogs.map((log) => ({ log, query })) : [];
      })
    );
    const logs = mergeRootRows(rootLogs.flat(), {
      limit,
      sortValue: ({ log }) => log.entries?.timestamp,
      dedupeKey: ({ log }) => transcriptMergeDedupeKey(log.entries, log.id),
    });

    return logs
      .map(({ log, query }): ChatMessage | null => {
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
          role: roleFromRootSenderId(query, entries.senderId as number),
          content: entries.content,
          timestamp: new Date(entries.timestamp as string),
          messageId: typeof entries.messageId === 'number' ? entries.messageId : undefined,
          sourceContext: query.context,
          mergeKey: transcriptMergeDedupeKey(entries, id),
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

export async function fetchMeetExchangesDirect(
  contactId: number,
  assistant: Assistant
): Promise<CallPill[]> {
  try {
    const queries = contactScopedRootQueries(assistant, contactId, 'Transcripts');
    const rootLogs = await Promise.all(
      queries.map(async (query) => {
        const filterExpr = meetExchangeFilterForRoot(query, assistant.agentId);
        const params = new URLSearchParams({
          projectName: 'Assistants',
          context: query.context,
          limit: '500',
          filterExpr,
        });

        const response = await fetch(`/api/logs?${params.toString()}`, {
          cache: 'no-store',
        });

        if (response.status === 404 || !response.ok) return [];

        const data = await response.json();
        const rootLogs = data?.logs;
        return Array.isArray(rootLogs) ? rootLogs.map((log) => ({ log, query })) : [];
      })
    );
    const logs = rootLogs.flat();

    if (!Array.isArray(logs) || logs.length === 0) return [];

    const exchangeGroups = new Map<
      string,
      {
        exchangeId: number;
        sourceContext: string;
        selfContactId: number;
        minTs: Date;
        maxTs: Date;
        count: number;
      }
    >();
    for (const { log, query } of logs) {
      const entries = log.entries;
      if (!entries) continue;
      const xid = typeof entries.exchangeId === 'number' ? entries.exchangeId : undefined;
      if (xid === undefined) continue;
      const ts = new Date(entries.timestamp as string);
      if (isNaN(ts.getTime())) continue;

      const groupKey = `${query.context}:${xid}`;
      const existing = exchangeGroups.get(groupKey);
      if (existing) {
        if (ts < existing.minTs) existing.minTs = ts;
        if (ts > existing.maxTs) existing.maxTs = ts;
        existing.count++;
      } else {
        exchangeGroups.set(groupKey, {
          exchangeId: xid,
          sourceContext: query.context,
          selfContactId: query.selfContactId,
          minTs: ts,
          maxTs: ts,
          count: 1,
        });
      }
    }

    return Array.from(exchangeGroups.values())
      .map((group) => {
        const durationSeconds = Math.round((group.maxTs.getTime() - group.minTs.getTime()) / 1000);
        return {
          id: `call-pill-${group.sourceContext}-${group.exchangeId}`,
          type: 'call_pill' as const,
          timestamp: group.maxTs,
          durationSeconds: Math.max(durationSeconds, 0),
          exchangeId: group.exchangeId,
          sourceContext: group.sourceContext,
          selfContactId: group.selfContactId,
        };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch {
    return [];
  }
}

/**
 * Prefetches contact IDs, transcripts, **and call pills** for all loaded
 * assistants in the background, on page load — before the user opens any
 * chat panel.
 *
 * Uses direct fetch() to /api/logs instead of server actions to bypass
 * Next.js 14's server action serialization queue. Server actions on a page
 * are processed sequentially (all POST /assistants calls queue up), which
 * delays the prefetch by seconds. Direct fetch uses session cookie auth
 * and runs concurrently with server actions.
 *
 * Contact IDs are stored in sessionStorage AND returned as React state so
 * callers (notably the page-level multiplex inbox stream) can react
 * to newly-resolved IDs without polling sessionStorage. Transcripts and
 * call pills are written directly into their respective state maps
 * (write-if-absent, so hooks' own writes always win).
 *
 * When the user eventually opens a chat, the chat hook sees
 * `chatHistories[assistantId] !== undefined` and takes the fast
 * "returning" branch — going straight to `ready` with zero loading state.
 *
 * This hook is fire-and-forget for the transcript/pill side effects — it
 * never blocks rendering or shows errors. The returned contactId map
 * reflects what the hook has resolved so far; it grows as fetches complete
 * and prunes when assistants are removed from the input list.
 */
export function useContactIdPrefetch(
  assistants: Assistant[],
  chatActions: Pick<AssistantActions, 'chat'>,
  userEmail: string | null | undefined,
  setChatHistories?: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>,
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>
): Record<string, number> {
  // Track which assistants we've already attempted to prefetch
  const attemptedRef = React.useRef<Set<string>>(new Set());
  const [contactIds, setContactIds] = React.useState<Record<string, number>>({});

  // Hydrate from sessionStorage (and prune removed assistants) whenever the
  // input list or user changes. Writes here are batched by React into a
  // single render pass, so callers don't see an incremental "one ID per
  // tick" reveal the way a sessionStorage poll would produce.
  React.useEffect(() => {
    if (!userEmail) {
      setContactIds((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    setContactIds((prev) => {
      const next: Record<string, number> = {};
      for (const a of assistants) {
        if (prev[a.agentId] !== undefined) {
          next[a.agentId] = prev[a.agentId];
          continue;
        }
        const cached = getSessionContactId(a.agentId, userEmail);
        if (cached !== undefined) next[a.agentId] = cached;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && prevKeys.every((k) => prev[k] === next[k])) {
        return prev;
      }
      return next;
    });
  }, [assistants, userEmail]);

  // Forget attempted-marks for assistants that left the list so a future
  // remount (e.g., re-hire) triggers a fresh prefetch.
  React.useEffect(() => {
    if (assistants.length === 0) return;
    const current = new Set(assistants.map((a) => a.agentId));
    for (const id of Array.from(attemptedRef.current)) {
      if (!current.has(id)) attemptedRef.current.delete(id);
    }
  }, [assistants]);

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
          : fetchContactIdDirect(email, assistant).then((id) => {
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
          if (contactId === null) return;

          // Surface the resolved ID as state so consumers (e.g. the inbox
          // multiplex) can react without polling sessionStorage.
          setContactIds((prev) =>
            prev[assistant.agentId] === contactId
              ? prev
              : { ...prev, [assistant.agentId]: contactId }
          );

          // Prefetch transcripts
          if (setChatHistories) {
            fetchTranscriptsDirect(contactId, assistant).then((result) => {
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
            });
          }

          // Prefetch call pills
          if (setCallPillHistories) {
            fetchMeetExchangesDirect(contactId, assistant).then((pills) => {
              clientLog('PREFETCH_CALL_PILLS', {
                assistant: assistant.agentId,
                count: pills.length,
              });
              setCallPillHistories((prev) => {
                if (prev[assistant.agentId] !== undefined) return prev;
                return { ...prev, [assistant.agentId]: pills };
              });
            });
          }
        })
        .catch((err) => {
          clientLog('PREFETCH_ERROR', { assistant: assistant.agentId, error: String(err) });
        });
    }
  }, [assistants, chatActions, userEmail, setChatHistories, setCallPillHistories]);

  return contactIds;
}
