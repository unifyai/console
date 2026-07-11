/**
 * Shares one assistant action EventSource across all consumers in a browser tab.
 *
 * Subscribers retain ownership of event parsing and UI state. This module owns
 * only the physical connection, its lifecycle, and raw-frame fan-out.
 */

export type AssistantActionStreamStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export type AssistantActionStreamSubscriber = {
  onMessage: (data: string) => void;
  onStatusChange?: (status: AssistantActionStreamStatus) => void;
};

type StreamEntry = {
  assistantId: string;
  source: EventSource | null;
  status: AssistantActionStreamStatus;
  subscribers: Set<AssistantActionStreamSubscriber>;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  terminalReconnectAttempts: number;
};

const streamRegistry = new Map<string, StreamEntry>();
const MAX_TERMINAL_RECONNECT_ATTEMPTS = 5;
const MAX_TERMINAL_RECONNECT_DELAY_MS = 15_000;

function clearReconnectTimer(entry: StreamEntry): void {
  if (!entry.reconnectTimer) return;
  clearTimeout(entry.reconnectTimer);
  entry.reconnectTimer = null;
}

function notifyStatus(entry: StreamEntry, status: AssistantActionStreamStatus): void {
  if (entry.status === status) return;
  entry.status = status;
  for (const subscriber of [...entry.subscribers]) {
    if (!entry.subscribers.has(subscriber)) continue;
    try {
      subscriber.onStatusChange?.(status);
    } catch (error) {
      console.error('[assistant-action-stream] Status subscriber failed:', error);
    }
  }
}

function openStream(entry: StreamEntry): void {
  if (entry.source || typeof EventSource === 'undefined') return;
  clearReconnectTimer(entry);

  const source = new EventSource(`/api/assistant/${entry.assistantId}/actions/stream`);
  entry.source = source;
  notifyStatus(entry, 'connecting');

  source.onopen = () => {
    if (entry.source !== source) return;
    entry.terminalReconnectAttempts = 0;
    notifyStatus(entry, 'connected');
  };

  source.onmessage = (event) => {
    if (entry.source !== source) return;
    for (const subscriber of [...entry.subscribers]) {
      if (!entry.subscribers.has(subscriber)) continue;
      try {
        subscriber.onMessage(event.data);
      } catch (error) {
        console.error('[assistant-action-stream] Message subscriber failed:', error);
      }
    }
  };

  source.onerror = () => {
    if (entry.source !== source) return;
    if (source.readyState === EventSource.CONNECTING) {
      notifyStatus(entry, 'reconnecting');
      return;
    }

    source.close();
    entry.source = null;
    notifyStatus(entry, 'error');
    if (
      entry.subscribers.size > 0 &&
      !entry.reconnectTimer &&
      entry.terminalReconnectAttempts < MAX_TERMINAL_RECONNECT_ATTEMPTS
    ) {
      const delayMs = Math.min(
        1_000 * 2 ** entry.terminalReconnectAttempts,
        MAX_TERMINAL_RECONNECT_DELAY_MS
      );
      entry.terminalReconnectAttempts += 1;
      entry.reconnectTimer = setTimeout(() => {
        entry.reconnectTimer = null;
        if (entry.subscribers.size > 0) openStream(entry);
      }, delayMs);
    }
  };
}

function scheduleTeardown(entry: StreamEntry): void {
  if (entry.teardownTimer) return;
  entry.teardownTimer = setTimeout(() => {
    entry.teardownTimer = null;
    if (entry.subscribers.size > 0) return;
    clearReconnectTimer(entry);
    entry.source?.close();
    entry.source = null;
    streamRegistry.delete(entry.assistantId);
  }, 0);
}

/**
 * Subscribes to raw action-stream frames for one assistant.
 *
 * The returned cleanup is idempotent. Teardown is deferred by one task so
 * React StrictMode remounts do not close and immediately reopen the stream.
 */
export function subscribeToAssistantActionStream(
  assistantId: string,
  subscriber: AssistantActionStreamSubscriber
): () => void {
  if (!assistantId || typeof EventSource === 'undefined') return () => {};

  let entry = streamRegistry.get(assistantId);
  if (!entry) {
    entry = {
      assistantId,
      source: null,
      status: 'connecting',
      subscribers: new Set(),
      teardownTimer: null,
      reconnectTimer: null,
      terminalReconnectAttempts: 0,
    };
    streamRegistry.set(assistantId, entry);
  }

  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }
  clearReconnectTimer(entry);
  entry.subscribers.add(subscriber);
  try {
    subscriber.onStatusChange?.(entry.status);
  } catch (error) {
    console.error('[assistant-action-stream] Initial status subscriber failed:', error);
  }
  openStream(entry);

  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    entry.subscribers.delete(subscriber);
    if (entry.subscribers.size === 0) scheduleTeardown(entry);
  };
}
