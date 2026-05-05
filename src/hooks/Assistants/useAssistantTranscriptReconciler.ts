'use client';

import * as React from 'react';
import { ChatMessage } from '@/types/assistants/chat';
import type { Assistant } from '@/types/assistants/assistant';
import { fetchTranscriptsDirect } from './useContactIdPrefetch';
import { clientLog } from '@/lib/logging/client-log-buffer';
import type { ChatStreamConnectionStatus } from './useAssistantChatStream';

/**
 * Page-level transcript reconciler — the polling fallback for the chat SSE.
 *
 * Why this exists:
 *   The chat SSE multiplex is the primary delivery path, but connections
 *   can silently fail (Vercel function timeout, Pub/Sub gRPC stream
 *   errors, tab-throttling on hidden tabs, network blips). When that
 *   happens we'd otherwise miss messages until either the user reloads
 *   the page or the SSE coincidentally reconnects. This hook periodically
 *   pulls the latest N transcripts via `/api/logs` and reconciles them
 *   into `profileChatHistories`, so any messages the SSE missed surface
 *   without user intervention.
 *
 * Why it lives at the page level (vs. inside `useAssistantProfileChat`):
 *   The previous implementation only polled the active panel's assistant.
 *   That left a gap for *backgrounded* chats whose subscription quietly
 *   died — their `chatHistories` would silently fall behind until the
 *   user opened the panel. Living at page level lets us reconcile any
 *   assistant whose stream is unhealthy, not just the visible one. It
 *   also means we don't pay the cost twice when both the chat panel and
 *   the call dialog's side panel are open for the same assistant.
 *
 * Cadence is adaptive — we don't blindly poll every 15 s for every chat:
 *
 *   active panel + connected   → 30 s   (safety net for messages that
 *                                        landed at the same ms as the
 *                                        cutoff, see `getChatStreamCutoff`
 *                                        in `Main.tsx`)
 *   active panel + connecting  → 15 s
 *   active panel + reconnecting→ 15 s
 *   active panel + error       → 5 s    (visible chat with broken SSE —
 *                                        this is when polling is most
 *                                        valuable to the user)
 *   backgrounded + error       → 30 s   (badge stays accurate without
 *                                        hammering the API)
 *   backgrounded + healthy     → skip   (SSE has it covered)
 *
 * On consecutive failures the per-assistant interval backs off
 * exponentially up to a 120 s ceiling, resetting on the first success.
 *
 * Tab-visibility gating: the coordinator no-ops while the tab is hidden
 * (the SSE stream's own visibility-aware reconnect handles backlog
 * redelivery on resume), and a one-shot tick is fired on
 * `visibilitychange → visible` so tab-resume is snappy.
 *
 * Initial-load safety: assistants whose `chatHistories[assistantId]` is
 * `undefined` (panel never opened in this session) are skipped. Pre-
 * populating an empty history with a 10-message poll window would cause
 * `useAssistantProfileChat` to take its `history_exists` branch on first
 * open and skip the full transcript fetch — leaving the user seeing
 * only the most recent 10 messages.
 */
export interface TranscriptReconcilerPair {
  assistantId: string;
  contactId: number;
  assistant: Assistant;
}

export interface UseAssistantTranscriptReconcilerOptions {
  pairs: TranscriptReconcilerPair[];
  /** Per-assistant SSE health, as published by `useAssistantChatStream`. */
  connectionStatusByAssistant: Record<string, ChatStreamConnectionStatus>;
  /**
   * Whichever assistant the user is actively looking at (profile chat
   * panel or call dialog side panel). Polled with the most aggressive
   * cadence, since misses here are the most user-visible.
   */
  activeAssistantId: string | null;
  enabled: boolean;
  /** Read-only — used to skip pre-populating histories that aren't loaded. */
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
}

const POLL_LIMIT = 10;
const COORDINATOR_TICK_MS = 5_000;

const INTERVAL_ACTIVE_ERROR = 5_000;
const INTERVAL_ACTIVE_RECONNECTING = 15_000;
const INTERVAL_ACTIVE_CONNECTED = 30_000;
const INTERVAL_BG_ERROR = 30_000;
const INTERVAL_INITIAL_DELAY_MS = 15_000;
const INTERVAL_MAX_BACKOFF_MS = 120_000;

interface AssistantPollState {
  nextPollAt: number;
  consecutiveErrors: number;
  inFlight: boolean;
}

function pickInterval(
  isActive: boolean,
  status: ChatStreamConnectionStatus | undefined
): number | null {
  if (isActive) {
    if (status === 'error') return INTERVAL_ACTIVE_ERROR;
    if (status === 'connecting' || status === 'reconnecting') {
      return INTERVAL_ACTIVE_RECONNECTING;
    }
    return INTERVAL_ACTIVE_CONNECTED;
  }
  if (status === 'error') return INTERVAL_BG_ERROR;
  return null;
}

function applyBackoff(base: number, errors: number): number {
  if (errors === 0) return base;
  return Math.min(base * 2 ** errors, INTERVAL_MAX_BACKOFF_MS);
}

interface MergeResult {
  merged: ChatMessage[];
  added: number;
  replaced: number;
}

/**
 * Reconciles a freshly-fetched transcript window into the existing chat
 * history. Dedupes first by `id` (the common path) and falls back to
 * `(role, content)` matching for messages where the SSE-delivered Pub/Sub
 * message id and the Orchestra log-entry id refer to the same logical
 * message. Returns `null` when nothing changed.
 *
 * `(role, content)` matches use a precomputed hash index instead of a
 * linear `findIndex` per fetched message — the previous per-panel
 * implementation was `O(n*m)` (n = full history length, m = poll window
 * size); for long conversations that was meaningful overhead on every
 * poll.
 */
function mergeFetchedIntoHistory(
  current: ChatMessage[],
  fetched: ChatMessage[]
): MergeResult | null {
  if (fetched.length === 0) return null;

  const existingIds = new Set<string>();
  const fallbackIndex = new Map<string, number[]>();
  for (let i = 0; i < current.length; i++) {
    existingIds.add(current[i].id);
    const key = `${current[i].role}\u0000${current[i].content}`;
    const arr = fallbackIndex.get(key);
    if (arr) arr.push(i);
    else fallbackIndex.set(key, [i]);
  }

  let reconciled: ChatMessage[] | null = null;
  let added = 0;
  let replaced = 0;
  const claimed = new Set<number>();

  for (const m of fetched) {
    if (existingIds.has(m.id)) continue;
    const key = `${m.role}\u0000${m.content}`;
    const candidates = fallbackIndex.get(key);
    let matchIdx = -1;
    if (candidates) {
      for (const idx of candidates) {
        if (!claimed.has(idx)) {
          matchIdx = idx;
          break;
        }
      }
    }
    if (!reconciled) reconciled = [...current];
    if (matchIdx !== -1) {
      claimed.add(matchIdx);
      reconciled[matchIdx] = m;
      replaced += 1;
    } else {
      reconciled.push(m);
      added += 1;
    }
  }

  if (!reconciled) return null;
  reconciled.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return { merged: reconciled, added, replaced };
}

export function useAssistantTranscriptReconciler({
  pairs,
  connectionStatusByAssistant,
  activeAssistantId,
  enabled,
  chatHistories,
  setChatHistories,
}: UseAssistantTranscriptReconcilerOptions): void {
  // Inputs that change on essentially every render are read via refs so
  // the coordinator effect doesn't tear down + restart (and lose its
  // per-assistant backoff state) on each re-render of the page.
  const statusRef = React.useRef(connectionStatusByAssistant);
  const activeIdRef = React.useRef(activeAssistantId);
  const setHistoriesRef = React.useRef(setChatHistories);
  const historiesRef = React.useRef(chatHistories);
  const pairsRef = React.useRef(pairs);

  React.useEffect(() => {
    statusRef.current = connectionStatusByAssistant;
  }, [connectionStatusByAssistant]);
  React.useEffect(() => {
    activeIdRef.current = activeAssistantId;
  }, [activeAssistantId]);
  React.useEffect(() => {
    setHistoriesRef.current = setChatHistories;
  }, [setChatHistories]);
  React.useEffect(() => {
    historiesRef.current = chatHistories;
  }, [chatHistories]);
  React.useEffect(() => {
    pairsRef.current = pairs;
  }, [pairs]);

  React.useEffect(() => {
    if (!enabled) return;

    const stateById = new Map<string, AssistantPollState>();
    let cancelled = false;

    const seedState = (assistantId: string): AssistantPollState => {
      let state = stateById.get(assistantId);
      if (!state) {
        // Defer the first poll for a brand-new pair — the panel's own
        // initial transcript fetch (or the prefetch hook) will have just
        // populated history; an immediate poll would just refetch the
        // same window for no benefit.
        state = {
          nextPollAt: Date.now() + INTERVAL_INITIAL_DELAY_MS,
          consecutiveErrors: 0,
          inFlight: false,
        };
        stateById.set(assistantId, state);
      }
      return state;
    };

    const pollOne = async (
      pair: TranscriptReconcilerPair,
      state: AssistantPollState
    ): Promise<void> => {
      // Skip pre-populating histories that aren't loaded yet — see the
      // module-level docstring's "Initial-load safety" note.
      if (historiesRef.current[pair.assistantId] === undefined) return;

      try {
        const result = await fetchTranscriptsDirect(pair.contactId, pair.assistant, POLL_LIMIT);
        if ('detail' in result) {
          state.consecutiveErrors += 1;
          clientLog('RECONCILER_FETCH_ERROR', {
            assistantId: pair.assistantId,
            detail: (result as { detail: string }).detail,
            consecutiveErrors: state.consecutiveErrors,
          });
          return;
        }
        state.consecutiveErrors = 0;
        const fetched = [...(result as ChatMessage[])].reverse();
        if (fetched.length === 0) return;

        setHistoriesRef.current((prev) => {
          const current = prev[pair.assistantId];
          if (current === undefined) return prev;
          const merge = mergeFetchedIntoHistory(current, fetched);
          if (!merge) return prev;
          clientLog('RECONCILER_MERGED', {
            assistantId: pair.assistantId,
            fetched: fetched.length,
            added: merge.added,
            replaced: merge.replaced,
            totalAfter: merge.merged.length,
          });
          return { ...prev, [pair.assistantId]: merge.merged };
        });
      } catch (err) {
        state.consecutiveErrors += 1;
        clientLog('RECONCILER_FETCH_EXCEPTION', {
          assistantId: pair.assistantId,
          error: String(err),
          consecutiveErrors: state.consecutiveErrors,
        });
      }
    };

    const tick = (): void => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      const now = Date.now();
      const status = statusRef.current;
      const active = activeIdRef.current;
      const livePairs = pairsRef.current;
      const liveIds = new Set<string>();

      for (const pair of livePairs) {
        liveIds.add(pair.assistantId);
        const state = seedState(pair.assistantId);
        if (state.inFlight) continue;
        const isActive = active === pair.assistantId;
        const base = pickInterval(isActive, status[pair.assistantId]);
        if (base === null) continue;
        if (now < state.nextPollAt) continue;

        state.inFlight = true;
        // Schedule the next poll *after* this one settles, with backoff —
        // otherwise a slow `/api/logs` response would let multiple polls
        // pile up for the same assistant.
        pollOne(pair, state).finally(() => {
          state.inFlight = false;
          const interval = applyBackoff(base, state.consecutiveErrors);
          state.nextPollAt = Date.now() + interval;
        });
      }

      // GC state for assistants that have left the workspace, otherwise
      // the map would grow unboundedly across long sessions.
      if (liveIds.size !== stateById.size) {
        for (const id of Array.from(stateById.keys())) {
          if (!liveIds.has(id)) stateById.delete(id);
        }
      }
    };

    const coordinator = setInterval(tick, COORDINATOR_TICK_MS);

    const onVisibilityChange = (): void => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      // Tab just regained focus — push every poll's due-time forward to
      // "now" so the next tick fires them immediately. (We don't reach
      // straight into `pollOne` here so the in-flight / backoff state
      // stays single-sourced inside `tick`.)
      const now = Date.now();
      stateById.forEach((state) => {
        if (!state.inFlight) state.nextPollAt = now;
      });
      tick();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      cancelled = true;
      clearInterval(coordinator);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [enabled]);
}
