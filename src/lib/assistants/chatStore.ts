import type { Attachment, ChatMessage } from '@/types/assistants/chat';
import { mapOrgChatReactions } from '@/utils/assistants/chat-reactions';

/**
 * Unified chat-store client helpers.
 *
 * Every Console chat surface is backed by Orchestra's unified chat store
 * (`chat_thread` / `chat_message`); assistant Transcripts are the runtime's
 * own memory mirror and are never read for chat history. These helpers map
 * store payloads (snake_case) into the UI's `ChatMessage` shape and resolve
 * assistant-DM threads, with a sessionStorage cache so panel opens don't
 * re-resolve.
 */

const THREAD_ID_SESSION_PREFIX = 'assistant_chat_thread_id:';

export function getSessionThreadId(assistantId: string, email?: string): number | undefined {
  const key = email
    ? `${THREAD_ID_SESSION_PREFIX}${email}:${assistantId}`
    : `${THREAD_ID_SESSION_PREFIX}${assistantId}`;
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

export function setSessionThreadId(assistantId: string, threadId: number, email?: string): void {
  const key = email
    ? `${THREAD_ID_SESSION_PREFIX}${email}:${assistantId}`
    : `${THREAD_ID_SESSION_PREFIX}${assistantId}`;
  try {
    sessionStorage.setItem(key, String(threadId));
  } catch {
    // sessionStorage unavailable
  }
}

export function mapStoreAttachments(raw: unknown, fallbackId: string): Attachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: Record<string, unknown>): Attachment => {
    const item = (a ?? {}) as Record<string, unknown>;
    return {
      id: (item.id as string) || fallbackId,
      filename: (item.filename as string) || 'attachment',
      gsUrl: (item.gs_url ?? item.gsUrl) as string | undefined,
      contentType: (item.content_type ?? item.contentType) as string | undefined,
      sizeBytes: (item.size_bytes ?? item.sizeBytes) as number | undefined,
    };
  });
}

/** Map one unified chat-store message payload into the UI ChatMessage. */
export function mapStoreMessage(raw: Record<string, unknown>): ChatMessage | null {
  const messageId = Number(raw.id);
  if (!Number.isFinite(messageId)) return null;
  const content = typeof raw.content === 'string' ? raw.content : '';
  const senderKind = (raw.sender_kind ?? raw.senderKind) as string | undefined;
  const timestampRaw = (raw.timestamp ?? raw.created_at) as string | undefined;
  const timestamp = timestampRaw ? new Date(timestampRaw) : new Date();
  if (isNaN(timestamp.getTime())) return null;
  return {
    id: String(messageId),
    role: senderKind === 'assistant' ? 'assistant' : 'user',
    content,
    timestamp,
    messageId,
    attachments: mapStoreAttachments(raw.attachments, String(messageId)),
    reactions: mapOrgChatReactions(raw.reactions),
  };
}

// In-flight thread resolution dedup: the prefetch hook and the chat panel
// may both resolve the same assistant's DM thread concurrently.
const inflightThreadIds = new Map<string, Promise<number | null>>();

/**
 * Resolve (get-or-create) the assistant-DM thread between the current user
 * and one assistant. Cached per session.
 */
export async function resolveAssistantDmThread(
  assistantId: string,
  email?: string
): Promise<number | null> {
  const cached = getSessionThreadId(assistantId, email);
  if (cached !== undefined) return cached;

  const key = `${assistantId}:${email ?? ''}`;
  const existing = inflightThreadIds.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<number | null> => {
    try {
      const response = await fetch('/api/chat/threads/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
        body: JSON.stringify({ kind: 'assistant_dm', assistant_id: parseInt(assistantId, 10) }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const threadId = Number(data?.thread_id);
      if (!Number.isFinite(threadId)) return null;
      setSessionThreadId(assistantId, threadId, email);
      return threadId;
    } catch {
      return null;
    } finally {
      inflightThreadIds.delete(key);
    }
  })();
  inflightThreadIds.set(key, promise);
  return promise;
}

/**
 * Fetch one thread's history via the unified store. Returns messages in
 * DESCENDING timestamp order (most recent first) to match the transcript
 * fetch contract callers already reverse.
 */
export async function fetchThreadMessages(
  threadId: number,
  options: { limit?: number; beforeId?: number } = {}
): Promise<ChatMessage[] | { detail: string }> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.beforeId) params.set('before_id', String(options.beforeId));
  try {
    const response = await fetch(`/api/chat/threads/${threadId}/messages?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { detail: data?.detail || `Failed to load chat history (${response.status})` };
    }
    const data = await response.json();
    const rawMessages = Array.isArray(data?.messages) ? data.messages : [];
    return rawMessages
      .map((raw: Record<string, unknown>) => mapStoreMessage(raw))
      .filter((message: ChatMessage | null): message is ChatMessage => message !== null)
      .reverse();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { detail: message };
  }
}
