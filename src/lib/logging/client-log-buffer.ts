/**
 * Persistent client-side log buffer.
 *
 * Collects structured diagnostic events in the browser and flushes them
 * to Orchestra via POST /api/client-logs. Every flush produces one
 * Orchestra log entry in the "ConsoleDiagnostics" project / "ChatClient"
 * context, queryable after the fact to reconstruct exactly what a user's
 * browser did during a chat session.
 *
 * Usage:
 *   import { clientLog, getSessionId } from '@/lib/logging/client-log-buffer';
 *   clientLog('MSG_RECV', { msgId, publishTime, ageMs });
 */

// ---------------------------------------------------------------------------
// Session ID — unique per browser tab, survives soft navigations
// ---------------------------------------------------------------------------

function initSessionId(): string {
  if (typeof sessionStorage === 'undefined') return crypto.randomUUID();
  const key = '_clog_sid';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

let _sessionId: string | null = null;

export function getSessionId(): string {
  if (!_sessionId) _sessionId = initSessionId();
  return _sessionId;
}

// ---------------------------------------------------------------------------
// Buffer + flush
// ---------------------------------------------------------------------------

interface LogEntry {
  event: string;
  data?: Record<string, unknown>;
  ts: string;
  sid: string;
}

interface FlushContext {
  assistantId?: string;
  contactId?: number | null;
}

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 20;

let buffer: LogEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushContext: FlushContext = {};

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (buffer.length === 0) return;

  const entries = buffer;
  buffer = [];

  const body = {
    assistantId: flushContext.assistantId,
    contactId: flushContext.contactId,
    entries,
  };

  fetch('/api/client-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

function schedule() {
  if (!timer) timer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

// Flush when the tab becomes hidden (user switching away or closing).
// `keepalive: true` on the fetch ensures the request completes even if
// the page is being unloaded.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the assistant/contact context for subsequent flushes.
 * Call this when the active assistant changes.
 */
export function setLogContext(ctx: FlushContext) {
  flushContext = ctx;
}

/**
 * Log a structured diagnostic event. The event is both `console.log`'d
 * (for live DevTools debugging) and buffered for persistent storage.
 */
export function clientLog(event: string, data?: Record<string, unknown>) {
  console.log(`[Chat Client] ${event}`, data ? JSON.stringify(data) : '');

  buffer.push({
    event,
    data,
    ts: new Date().toISOString(),
    sid: getSessionId(),
  });

  if (buffer.length >= FLUSH_THRESHOLD) flush();
  else schedule();
}
