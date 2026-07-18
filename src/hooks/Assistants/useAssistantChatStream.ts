import * as React from 'react';
import { clientLog, setLogContext, getSessionId } from '@/lib/logging/client-log-buffer';
import {
  parseChatSseFrame,
  type ParsedInboundChatMessage,
  type ParsedReactionUpdate,
} from '@/utils/assistants/chat-sse-frame';

/**
 * Page-level chat SSE stream.
 *
 * Opens N `EventSource` connections against `/api/assistant/events/chat-stream`
 * — one per shard of up to `CHAT_STREAM_SHARD_SIZE` `(assistantId, contactId)`
 * pairs — so we can support workspaces with far more active conversations than
 * a single request can fit (URL length, Pub/Sub streaming-pull load, server
 * `MAX_PAIRS` cap). For typical workspaces the pair list fits in one shard and
 * the behaviour is identical to a single connection. Each frame carries its
 * own `assistantId` so the hook can demux across shards and hand it off to
 * the caller.
 *
 * This is the sole transport for assistant chat messages: both the unread-
 * badge bookkeeping on the assistants list and the currently-open chat panel
 * read from state that is populated via this hook's callbacks. The chat panel
 * does not open its own SSE — it receives connection status, reconnect, and
 * per-assistant activity signals from the page through props.
 *
 * Responsibilities
 * ----------------
 *  - EventSource lifecycle per shard: open / close / reconnect / exponential
 *    backoff. Per-shard transport status is published into React state and
 *    combined with per-assistant subscription overrides (server-emitted
 *    `subscription_error` / `subscription_ok` control frames) to produce a
 *    `connectionStatusByAssistant` map; the aggregate `connectionStatus`
 *    reports the worst entry across the map (error > reconnecting >
 *    connecting > connected).
 *  - Frame parsing via the shared `parseChatSseFrame`.
 *  - Unread-count bookkeeping per assistant, with a `lastReadAt` cursor
 *    persisted in `localStorage` so counts survive page reloads for messages
 *    received while the assistants page was mounted and streaming.
 *  - Exposing `markAsRead(assistantId)` for the page to call when the user
 *    opens a chat panel or otherwise "sees" the messages.
 *  - Scheduling per-shard exponential-backoff retries when the server reports
 *    that some pairs were skipped (e.g. topic not yet provisioned during
 *    hire races).
 *
 * Non-responsibilities
 *  - Merging messages into `chatHistories` (that's a caller concern — the
 *    page passes its `setChatHistories` via `onChatMessage`).
 *  - Cross-tab `BroadcastChannel` propagation, typing indicators, or any
 *    panel-specific UI state.
 *  - Pub/Sub ack. The chat-stream route acks server-side after enqueueing
 *    onto each connection's private ephemeral subscription.
 */

export type ChatStreamConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ChatStreamPair {
  assistantId: string;
  contactId: number;
  rootKey: string;
  sourceContext: string;
}

export interface UseAssistantChatStreamCallbacks {
  /**
   * Fires for every parsed `unify_message_outbound` frame (post-filter).
   * The caller MUST dedup against existing chat history by
   * `parsed.message.id` — the same logical message may also be delivered via
   * cross-tab `BroadcastChannel` when another tab receives it first.
   */
  onChatMessage: (assistantId: string, parsed: ParsedInboundChatMessage) => void;
  /** Fires for parsed `unify_message_reaction_outbound` frames. */
  onReactionUpdate?: (assistantId: string, parsed: ParsedReactionUpdate) => void;
  /** Fires when an `assistant_desktop_ready` frame arrives. */
  onDesktopReady?: (assistantId: string, eventData: Record<string, unknown>) => void;
  /**
   * Fires when a call-session signaling frame arrives on the assistant topic
   * (`call_incoming` when the assistant rings its human, plus
   * answered/ended/declined lifecycle updates). `eventData` is the call
   * session event payload.
   */
  onCallFrame?: (
    assistantId: string,
    action: 'incoming' | 'answered' | 'ended' | 'declined',
    eventData: Record<string, unknown>
  ) => void;
  /**
   * Fires on every inbound SSE frame before parsing. Drives activity
   * indicators (typing bubbles, online presence) that should react to all
   * assistant-originated frames, not just post-filter chat messages.
   */
  onMessageActivity?: (assistantId: string) => void;
}

export interface UseAssistantChatStreamOptions {
  /** Optional per-assistant cutoff ms — drops frames older than the cutoff. */
  getCutoff?: (assistantId: string) => number;
  /** Threaded into `setLogContext` on connect for log correlation. */
  userEmail?: string | null;
  /**
   * Signed-in user's id. Unified chat-store frames carry the assistant-DM
   * thread's human party as `user_id`; frames for other users' threads with
   * the same assistant are dropped client-side.
   */
  userId?: string | null;
  /**
   * When set AND the tab is currently visible, the unread count for
   * `activeAssistantId` is never bumped — those messages are considered
   * "seen as they arrive" because the user is already looking at the chat.
   * Pass `null` when no chat panel is open. This avoids a visible badge
   * flicker (bump → markAsRead clear) that would otherwise happen on every
   * inbound message for the open chat.
   *
   * Visibility gating: when the tab is hidden (`document.visibilityState
   * !== 'visible'`) suppression is bypassed so messages arriving for the
   * currently-selected assistant still raise the badge / tab-title
   * counter. The badge is then cleared on the next `visibilitychange`
   * back to `'visible'`.
   */
  activeAssistantId?: string | null;
}

export interface ChatStreamHandle {
  /**
   * Aggregate status across every shard's transport AND every per-assistant
   * subscription override. Useful for "is anything degraded?" checks (e.g.
   * the workspace-wide health pill); panels should prefer
   * `connectionStatusByAssistant` so a single bad subscription doesn't mark
   * unrelated chats as disconnected.
   */
  connectionStatus: ChatStreamConnectionStatus;
  /**
   * Per-assistant connection status. Combines (a) the shard's transport
   * status — `'error'` / `'reconnecting'` / `'connecting'` / `'connected'`
   * — with (b) a per-assistant override published by the server via the
   * `subscription_error` / `subscription_ok` control frames. The override
   * pins an assistant to `'error'` while its individual Pub/Sub subscription
   * is unhealthy, even if the underlying SSE connection is fine.
   *
   * Lookup default for unknown assistantIds is `'connecting'` (mirrors the
   * initial state for in-flight pairs).
   */
  connectionStatusByAssistant: Record<string, ChatStreamConnectionStatus>;
  reconnect: () => void;
  /**
   * Unread count per assistantId. A count of 0 (or missing key) means the
   * assistant's list item should render no badge. See `markAsRead` for the
   * clear path.
   */
  unreadCounts: Record<string, number>;
  /**
   * Clears the unread count for `assistantId` and persists a new
   * `lastReadAt` cursor keyed by the user so future pageloads don't re-count
   * messages the user has already seen.
   */
  markAsRead: (assistantId: string) => void;
}

const SSE_MAX_RECONNECT_ATTEMPTS = 5;
const SSE_RECONNECT_BASE_DELAY = 1000;
// Skipped-pair retry schedule: starts at 30s, doubles until a 5-minute cap,
// then holds there. A skipped pair typically means "Pub/Sub topic not yet
// provisioned" (e.g. the hire flow is still racing with Communication), so
// short retries give the assistant a fast path back into the stream while
// the cap prevents runaway traffic on a permanently-broken topic.
const SKIPPED_RETRY_BASE_DELAY_MS = 30_000;
const SKIPPED_RETRY_MAX_DELAY_MS = 5 * 60_000;
// Keep shards comfortably under the server-side `MAX_PAIRS` cap so a workspace
// that sits right on the boundary doesn't 400 out. Sized so that typical
// single-digit workspaces still get one shard (same behaviour as before
// sharding was introduced).
export const CHAT_STREAM_SHARD_SIZE = 25;
// Storage key predates the hook rename; preserved so users don't lose their
// unread cursors on upgrade.
const LAST_READ_STORAGE_PREFIX = 'assistant_inbox_last_read:';
// Companion storage for the in-memory `unreadCounts` map. Persisting it
// means the badge survives a page reload for messages that arrived while
// this tab was streaming. Ephemeral chat subscriptions do not rebuild
// badges from a Pub/Sub backlog after reconnect. Cleared per-assistant by
// `markAsRead`.
const UNREAD_COUNTS_STORAGE_PREFIX = 'assistant_inbox_unread_counts:';

function chunkPairs(pairs: ChatStreamPair[], size: number): ChatStreamPair[][] {
  if (pairs.length === 0) return [];
  // Sort by assistantId so shard membership is deterministic across renders:
  // a given assistant always lands in the same shard as long as the pair set
  // is stable, so we don't needlessly tear down and re-open connections.
  const sorted = [...pairs].sort((a, b) => a.assistantId.localeCompare(b.assistantId));
  const shards: ChatStreamPair[][] = [];
  for (let i = 0; i < sorted.length; i += size) {
    shards.push(sorted.slice(i, i + size));
  }
  return shards;
}

function aggregateStatus(statuses: ChatStreamConnectionStatus[]): ChatStreamConnectionStatus {
  if (statuses.length === 0) return 'connecting';
  if (statuses.some((s) => s === 'error')) return 'error';
  if (statuses.some((s) => s === 'reconnecting')) return 'reconnecting';
  if (statuses.some((s) => s === 'connecting')) return 'connecting';
  return 'connected';
}

type LastReadMap = Record<string, number>;

function lastReadStorageKey(userEmail: string | null | undefined): string | null {
  if (!userEmail) return null;
  return `${LAST_READ_STORAGE_PREFIX}${userEmail}`;
}

function readLastReadMap(userEmail: string | null | undefined): LastReadMap {
  const key = lastReadStorageKey(userEmail);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as LastReadMap;
  } catch {
    // localStorage unavailable or malformed JSON
  }
  return {};
}

function writeLastReadMap(userEmail: string | null | undefined, map: LastReadMap): void {
  const key = lastReadStorageKey(userEmail);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // quota / privacy mode
  }
}

function unreadCountsStorageKey(userEmail: string | null | undefined): string | null {
  if (!userEmail) return null;
  return `${UNREAD_COUNTS_STORAGE_PREFIX}${userEmail}`;
}

function readUnreadCounts(userEmail: string | null | undefined): Record<string, number> {
  const key = unreadCountsStorageKey(userEmail);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Strip any non-positive entries — they'd render as a "0" badge.
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeUnreadCounts(
  userEmail: string | null | undefined,
  counts: Record<string, number>
): void {
  const key = unreadCountsStorageKey(userEmail);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(counts));
  } catch {
    // quota / privacy mode
  }
}

export function useAssistantChatStream(
  pairs: ChatStreamPair[],
  enabled: boolean,
  callbacks: UseAssistantChatStreamCallbacks,
  options: UseAssistantChatStreamOptions = {}
): ChatStreamHandle {
  const [reconnectTrigger, setReconnectTrigger] = React.useState(0);

  // Callbacks + options stashed in refs so the SSE effect reads the latest
  // values without re-subscribing on every render.
  const callbacksRef = React.useRef(callbacks);
  callbacksRef.current = callbacks;
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  // Per-assistant contactId lookup, rebuilt whenever the pairs list changes.
  const pairsSignature = React.useMemo(
    () =>
      pairs
        .map((p) => `${p.assistantId}:${p.contactId}:${p.rootKey}`)
        .sort()
        .join(','),
    [pairs]
  );

  // Shard membership is derived from `pairs` — pre-computed here (rather
  // than only inside the SSE effect) so we can map an assistantId to the
  // shard whose transport status governs it without re-deriving on every
  // status update.
  const shards = React.useMemo(
    () => chunkPairs(pairs, CHAT_STREAM_SHARD_SIZE),
    // pairsSignature captures the only change that affects shard membership;
    // depending on the array reference would re-shard on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairsSignature]
  );

  // Per-shard transport status, mirrored from the SSE effect's closure
  // state. Held as React state so per-assistant status (which derives from
  // it) can re-render panels when transport status changes.
  const [shardStatuses, setShardStatuses] = React.useState<ChatStreamConnectionStatus[]>(() =>
    shards.map(() => 'connecting')
  );
  React.useEffect(() => {
    // Resize the status array when the shard count changes (e.g. an assistant
    // was hired and bumped the workspace into a new shard). Existing shards
    // keep their last-known status; new shards start in 'connecting'.
    setShardStatuses((prev) => {
      if (prev.length === shards.length) return prev;
      const next = shards.map((_, i) => prev[i] ?? 'connecting');
      return next;
    });
  }, [shards]);

  // Per-assistant subscription overrides. Server emits `subscription_error`
  // / `subscription_ok` control frames when an individual subscription
  // changes health; an assistantId in this set is pinned to `'error'` even
  // if its shard's transport is fine.
  const [subErrorAssistants, setSubErrorAssistants] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );

  // Drop overrides for assistants that are no longer in the pair set —
  // otherwise a stale entry would leak unread state across pair changes.
  React.useEffect(() => {
    setSubErrorAssistants((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(pairs.map((p) => p.assistantId));
      let mutated = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (live.has(id)) next.add(id);
        else mutated = true;
      });
      return mutated ? next : prev;
    });
  }, [pairsSignature, pairs]);

  const connectionStatusByAssistant = React.useMemo<
    Record<string, ChatStreamConnectionStatus>
  >(() => {
    const out: Record<string, ChatStreamConnectionStatus> = {};
    for (let i = 0; i < shards.length; i++) {
      const shardStatus = shardStatuses[i] ?? 'connecting';
      for (const p of shards[i]) {
        out[p.assistantId] = subErrorAssistants.has(p.assistantId) ? 'error' : shardStatus;
      }
    }
    return out;
  }, [shards, shardStatuses, subErrorAssistants]);

  const connectionStatus = React.useMemo(
    () => aggregateStatus(Object.values(connectionStatusByAssistant)),
    [connectionStatusByAssistant]
  );
  const pairContextsRef = React.useRef<Map<string, ChatStreamPair>>(new Map());
  React.useEffect(() => {
    const next = new Map<string, ChatStreamPair>();
    for (const p of pairs) {
      next.set(`${p.assistantId}:${p.contactId}:${p.rootKey}`, p);
    }
    pairContextsRef.current = next;
  }, [pairs]);

  // Unread accounting state. Two cooperating sources of truth, both
  // persisted per-user in localStorage:
  //   - `lastReadAt`: the timestamp of the last "user opened this chat"
  //     event for each assistant. Acts as the floor for counting an
  //     incoming message as unread.
  //   - `unreadCounts`: the current per-assistant badge value, mirrored
  //     to storage on every mutation. Persisting it restores the badge
  //     across reloads for messages received while a live stream was
  //     mounted. Messages published with no live chat-stream connection
  //     are not replayed from Pub/Sub (ephemeral fan-out).
  const userEmail = options.userEmail ?? null;
  const [unreadCounts, setUnreadCounts] = React.useState<Record<string, number>>(() =>
    typeof window === 'undefined' ? {} : readUnreadCounts(options.userEmail ?? null)
  );
  const lastReadAtRef = React.useRef<LastReadMap>({});

  React.useEffect(() => {
    lastReadAtRef.current = readLastReadMap(userEmail);
    // Re-hydrate counts when the user changes so a session switch in the
    // same tab doesn't carry another user's unread state.
    setUnreadCounts(readUnreadCounts(userEmail));
  }, [userEmail]);

  // Mirror unread state to storage on every change (including reads /
  // bumps from any code path). One write per render that touched the map
  // — cheap relative to the per-message bumps it tracks.
  React.useEffect(() => {
    writeUnreadCounts(userEmail, unreadCounts);
  }, [userEmail, unreadCounts]);

  // First-encounter seeding. For any assistant in `pairs` without a
  // persisted `lastReadAt`, seed `now` so the first session does not treat
  // historical frames as unread if any briefly overlap a reconnect. This
  // effect runs whenever the workspace's pair set changes (initial mount,
  // hire, removal), so newly-hired assistants are seeded right away
  // rather than starting from epoch.
  React.useEffect(() => {
    if (pairs.length === 0) return;
    const stored = lastReadAtRef.current;
    const now = Date.now();
    let mutated = false;
    const next: LastReadMap = { ...stored };
    for (const p of pairs) {
      if (next[p.assistantId] === undefined) {
        next[p.assistantId] = now;
        mutated = true;
      }
    }
    if (mutated) {
      lastReadAtRef.current = next;
      writeLastReadMap(userEmail, next);
    }
  }, [pairsSignature, userEmail, pairs]);

  const markAsRead = React.useCallback(
    (assistantId: string) => {
      setUnreadCounts((prev) => {
        if (!prev[assistantId]) return prev;
        const { [assistantId]: _omit, ...rest } = prev;
        return rest;
      });
      const next: LastReadMap = {
        ...lastReadAtRef.current,
        [assistantId]: Date.now(),
      };
      lastReadAtRef.current = next;
      writeLastReadMap(userEmail, next);
    },
    [userEmail]
  );

  // Tab visibility tracking. Read by the message handler to decide whether
  // the active chat suppression (`activeAssistantId`) should apply: a user
  // who has assistant A selected but is on a different browser tab still
  // wants the badge to climb so the title-bar counter can reflect it.
  const isTabVisibleRef = React.useRef<boolean>(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  );
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      const nowVisible = document.visibilityState === 'visible';
      isTabVisibleRef.current = nowVisible;
      // On returning to the tab, clear the badge for whichever assistant
      // the user is "looking at" — we suppressed the live bumps while
      // hidden, but the user only needs the cumulative-while-away count,
      // not a phantom badge for the chat they're now actively viewing.
      if (nowVisible) {
        const activeId = optionsRef.current.activeAssistantId;
        if (activeId) markAsRead(activeId);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [markAsRead]);

  React.useEffect(() => {
    if (!enabled || pairs.length === 0) {
      setShardStatuses((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    interface ShardState {
      id: number;
      pairs: ChatStreamPair[];
      eventSource: EventSource | null;
      status: ChatStreamConnectionStatus;
      connectionAttempts: number;
      connectionTimer: ReturnType<typeof setTimeout> | null;
      skippedRetryAttempts: number;
      skippedRetryTimer: ReturnType<typeof setTimeout> | null;
    }

    const shardStates: ShardState[] = shards.map((shardPairs, i) => ({
      id: i,
      pairs: shardPairs,
      eventSource: null,
      status: 'connecting',
      connectionAttempts: 0,
      connectionTimer: null,
      skippedRetryAttempts: 0,
      skippedRetryTimer: null,
    }));

    // Push the shard's status into React state so per-assistant
    // `connectionStatusByAssistant` re-derives and panels re-render.
    const publishShardStatus = (shard: ShardState) => {
      setShardStatuses((prev) => {
        if (prev[shard.id] === shard.status && prev.length === shardStates.length) return prev;
        const next = shardStates.map((s, i) =>
          i === shard.id ? shard.status : (prev[i] ?? s.status)
        );
        return next;
      });
    };
    setShardStatuses(shardStates.map((s) => s.status));

    // Eagerly re-open a specific shard without tearing down the rest. Used by
    // the onerror backoff path and by the skipped-pair retry timer.
    const reopenShard = (shard: ShardState) => {
      if (shard.eventSource) {
        shard.eventSource.close();
        shard.eventSource = null;
      }
      openShard(shard);
    };

    const openShard = (shard: ShardState) => {
      const pairsParam = shard.pairs
        .map((p) => `${p.assistantId}:${p.contactId}:${p.rootKey}`)
        .join(',');
      const url = `/api/assistant/events/chat-stream?pairs=${encodeURIComponent(pairsParam)}&sid=${getSessionId()}&shard=${shard.id}`;
      const eventSource = new EventSource(url);
      shard.eventSource = eventSource;
      shard.status = 'connecting';
      publishShardStatus(shard);

      eventSource.onopen = () => {
        clientLog('CHAT_STREAM_OPEN', {
          shardId: shard.id,
          shardCount: shards.length,
          count: shard.pairs.length,
        });
        setLogContext({
          userEmail: optionsRef.current.userEmail ?? undefined,
        });
        shard.status = 'connected';
        shard.connectionAttempts = 0;
        publishShardStatus(shard);
        // Any pending skipped-pair retry for this shard is superseded by
        // a fresh connect: the server will resend the control frame if it
        // still has to skip anything.
        if (shard.skippedRetryTimer) {
          clearTimeout(shard.skippedRetryTimer);
          shard.skippedRetryTimer = null;
        }
        shard.skippedRetryAttempts = 0;
      };

      eventSource.onmessage = (event) => {
        let parsedHeader: Record<string, unknown>;
        try {
          parsedHeader = JSON.parse(event.data);
        } catch {
          clientLog('CHAT_STREAM_MSG_ERROR', { shardId: shard.id, error: 'envelope parse' });
          return;
        }

        // Server-side control frames (subscription status, etc.) don't carry
        // an `assistantId`; handle them before the demux.
        if (parsedHeader.__mux_control === 'subscription_status') {
          const skipped = Array.isArray(parsedHeader.skipped)
            ? (parsedHeader.skipped as Array<{
                assistantId: string;
                contactId?: number;
                rootKey?: string;
                reason: string;
              }>)
            : [];
          // Filter skipped entries to ones still in our current pair set —
          // there's no point retrying for an assistant the page has since
          // removed.
          const stillRelevant = skipped.filter((s) => {
            const contactId = typeof s.contactId === 'number' ? s.contactId : undefined;
            const rootKey = typeof s.rootKey === 'string' ? s.rootKey : undefined;
            return (
              contactId !== undefined &&
              rootKey !== undefined &&
              pairContextsRef.current.has(`${s.assistantId}:${contactId}:${rootKey}`)
            );
          });
          clientLog('CHAT_STREAM_SUBS_STATUS', {
            shardId: shard.id,
            connected: Array.isArray(parsedHeader.connected) ? parsedHeader.connected : [],
            skipped,
            stillRelevant: stillRelevant.map((s) => s.assistantId),
          });
          if (stillRelevant.length === 0) return;

          const attempt = shard.skippedRetryAttempts;
          const delay = Math.min(
            SKIPPED_RETRY_BASE_DELAY_MS * Math.pow(2, attempt),
            SKIPPED_RETRY_MAX_DELAY_MS
          );
          shard.skippedRetryAttempts = attempt + 1;

          if (shard.skippedRetryTimer) {
            clearTimeout(shard.skippedRetryTimer);
          }
          clientLog('CHAT_STREAM_SKIPPED_RETRY_SCHEDULED', {
            shardId: shard.id,
            attempt,
            delayMs: delay,
            count: stillRelevant.length,
          });
          shard.skippedRetryTimer = setTimeout(() => {
            shard.skippedRetryTimer = null;
            reopenShard(shard);
          }, delay);
          return;
        }

        // Per-subscription health control frames: pin / unpin a single
        // assistant to an 'error' status without disturbing the rest of
        // the shard. Server emits these on transitions only, so processing
        // is idempotent and cheap.
        if (
          parsedHeader.__mux_control === 'subscription_error' ||
          parsedHeader.__mux_control === 'subscription_ok'
        ) {
          const targetId =
            typeof parsedHeader.assistantId === 'string' ? parsedHeader.assistantId : null;
          if (!targetId) return;
          const isError = parsedHeader.__mux_control === 'subscription_error';
          clientLog(isError ? 'CHAT_STREAM_SUB_ERROR' : 'CHAT_STREAM_SUB_OK', {
            shardId: shard.id,
            assistantId: targetId,
            reason: isError ? String(parsedHeader.reason ?? '') : undefined,
          });
          setSubErrorAssistants((prev) => {
            const has = prev.has(targetId);
            if (isError === has) return prev;
            const next = new Set(prev);
            if (isError) next.add(targetId);
            else next.delete(targetId);
            return next;
          });
          return;
        }

        const assistantIdFromFrame =
          typeof parsedHeader.assistantId === 'string' ? parsedHeader.assistantId : null;
        if (!assistantIdFromFrame) {
          clientLog('CHAT_STREAM_NO_ASSISTANT', { shardId: shard.id });
          return;
        }

        const assistantId = assistantIdFromFrame;
        const subscriptionContactIdRaw = parsedHeader.subscriptionContactId;
        const subscriptionContactId =
          typeof subscriptionContactIdRaw === 'number'
            ? subscriptionContactIdRaw
            : typeof subscriptionContactIdRaw === 'string'
              ? Number.parseInt(subscriptionContactIdRaw, 10)
              : undefined;
        const subscriptionRootKey =
          typeof parsedHeader.subscriptionRootKey === 'string'
            ? parsedHeader.subscriptionRootKey
            : undefined;
        const pair =
          subscriptionContactId !== undefined &&
          !Number.isNaN(subscriptionContactId) &&
          subscriptionRootKey !== undefined
            ? pairContextsRef.current.get(
                `${assistantId}:${subscriptionContactId}:${subscriptionRootKey}`
              )
            : undefined;
        if (!pair) {
          // The server sent us a frame for a pair we didn't subscribe to, or
          // the pair was removed mid-stream. Drop it.
          clientLog('CHAT_STREAM_UNKNOWN_ASSISTANT', { shardId: shard.id, assistantId });
          return;
        }
        const myContactId = pair.contactId;

        callbacksRef.current.onMessageActivity?.(assistantId);

        // In-chat progress clearing runs in the chat merge callback after a
        // successful assistant message merge — not on every SSE frame.

        const cutoff = optionsRef.current.getCutoff?.(assistantId) ?? 0;
        const frame = parseChatSseFrame(event.data, {
          myContactId,
          myUserId: optionsRef.current.userId ?? undefined,
          rootKey: pair.rootKey,
          sourceContext: pair.sourceContext,
          cutoffMs: cutoff,
        });

        switch (frame.kind) {
          case 'filtered': {
            clientLog(
              frame.reason === 'contact'
                ? 'CHAT_STREAM_FILTERED_CONTACT'
                : frame.reason === 'root'
                  ? 'CHAT_STREAM_FILTERED_ROOT'
                  : 'CHAT_STREAM_FILTERED_CUTOFF',
              { ...frame.details, assistantId, shardId: shard.id }
            );
            return;
          }
          case 'desktop-ready': {
            callbacksRef.current.onDesktopReady?.(assistantId, frame.eventData);
            return;
          }
          case 'call-frame': {
            callbacksRef.current.onCallFrame?.(assistantId, frame.action, frame.eventData);
            return;
          }
          case 'reaction': {
            callbacksRef.current.onReactionUpdate?.(assistantId, frame.parsed);
            return;
          }
          case 'chat': {
            const publishMs = frame.parsed.publishTime
              ? new Date(frame.parsed.publishTime).getTime()
              : Date.now();
            clientLog('CHAT_STREAM_MSG_RECV', {
              shardId: shard.id,
              assistantId,
              msgId: frame.msgId,
              publishTime: frame.parsed.publishTime ?? 'none',
              ageMs: Date.now() - publishMs,
              thread: frame.thread,
              content: frame.contentPreview,
            });

            callbacksRef.current.onChatMessage(assistantId, frame.parsed);

            // Unread accounting — anything newer than the persisted
            // `lastReadAt` cursor counts. The cursor is seeded to `now`
            // on first encounter (see effect above). Live frames while the
            // page is open bump the badge; reconnect gaps rely on the
            // transcript reconciler for loaded chats.
            const floor = lastReadAtRef.current[assistantId] ?? 0;
            // Suppress only when the assistant is "active" AND the tab is
            // visible: a hidden tab can't actually show the message, so
            // bumping the badge / tab-title counter is what the user
            // expects when they tab back.
            const isActive =
              optionsRef.current.activeAssistantId === assistantId && isTabVisibleRef.current;
            if (publishMs > floor && !isActive) {
              setUnreadCounts((prev) => ({
                ...prev,
                [assistantId]: (prev[assistantId] ?? 0) + 1,
              }));
            }
            return;
          }
          case 'ignored': {
            clientLog('CHAT_STREAM_IGNORED_THREAD', {
              shardId: shard.id,
              assistantId,
              msgId: frame.msgId,
              thread: frame.thread,
            });
            return;
          }
          case 'error': {
            clientLog('CHAT_STREAM_MSG_ERROR', {
              shardId: shard.id,
              assistantId,
              error: frame.error,
            });
            return;
          }
        }
      };

      eventSource.onerror = () => {
        const attempt = shard.connectionAttempts;
        const willRetry = attempt < SSE_MAX_RECONNECT_ATTEMPTS;
        const delay = willRetry ? SSE_RECONNECT_BASE_DELAY * Math.pow(2, attempt) : 0;
        clientLog('CHAT_STREAM_ERROR', {
          shardId: shard.id,
          count: shard.pairs.length,
          attempt,
          maxAttempts: SSE_MAX_RECONNECT_ATTEMPTS,
          willRetry,
          retryDelayMs: delay,
        });

        eventSource.close();
        shard.eventSource = null;

        if (willRetry) {
          shard.status = 'reconnecting';
          shard.connectionAttempts = attempt + 1;
          publishShardStatus(shard);

          if (shard.connectionTimer) {
            clearTimeout(shard.connectionTimer);
          }
          shard.connectionTimer = setTimeout(() => {
            shard.connectionTimer = null;
            openShard(shard);
          }, delay);
        } else {
          clientLog('CHAT_STREAM_GAVE_UP', {
            shardId: shard.id,
            count: shard.pairs.length,
            maxAttempts: SSE_MAX_RECONNECT_ATTEMPTS,
          });
          shard.status = 'error';
          shard.connectionAttempts = 0;
          publishShardStatus(shard);
        }
      };
    };

    for (const shard of shardStates) openShard(shard);

    return () => {
      for (const shard of shardStates) {
        if (shard.eventSource) shard.eventSource.close();
        if (shard.connectionTimer) clearTimeout(shard.connectionTimer);
        if (shard.skippedRetryTimer) clearTimeout(shard.skippedRetryTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pairsSignature, reconnectTrigger]);

  const reconnect = React.useCallback(() => {
    setReconnectTrigger((prev) => prev + 1);
  }, []);

  return {
    connectionStatus,
    connectionStatusByAssistant,
    reconnect,
    unreadCounts,
    markAsRead,
  };
}
