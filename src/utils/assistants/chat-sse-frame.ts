import { v4 as uuidv4 } from 'uuid';
import type { Attachment, ChatMessage, MessageReaction } from '@/types/assistants/chat';
import { snakeToCamelObject } from '@/utils/casing';
import { mapTranscriptReactions } from '@/utils/assistants/chat-reactions';

/**
 * Pure parser for a single Pub/Sub → SSE frame coming from the page-level
 * chat stream (`/api/assistant/events/chat-stream`).
 *
 * Frames carry a top-level `assistantId` so the client can demux the
 * multiplexed stream before handing the parsed message to the consumer.
 *
 * This helper lives in its own module so the page-level orchestrator and any
 * future consumer of the same frame shape stay byte-identical in how they
 * interpret contact-id filtering, cutoff filtering, attachment shape, id
 * resolution, and the assistant-desktop-ready side channel.
 */

export interface ParsedInboundChatMessage {
  /** Built ChatMessage ready for merge. `__ackId` is attached if present. */
  message: ChatMessage;
  /** Contact subscription that delivered this frame. Used for ACK routing. */
  contactId: number;
  /** Root subscription that delivered this frame. Used for ACK routing. */
  rootKey: string;
  /** Root context that delivered this frame. Used for rendering and filtering. */
  sourceContext?: string;
  /** Raw publish time (ISO) from the SSE envelope, if any. */
  publishTime?: string;
  /**
   * `true` when the SSE payload carried a server-assigned message id;
   * `false` when the id was generated client-side via uuidv4 because the
   * payload didn't include one. Callers can use this to choose between
   * id-based and content-based dedup against existing history.
   */
  hasServerMessageId: boolean;
}

export interface ParsedReactionUpdate {
  targetMessageId: number;
  contactId: number;
  emoji: string | null;
  action: 'added' | 'changed' | 'removed';
  reactions: MessageReaction[];
  rootKey: string;
  sourceContext?: string;
  publishTime?: string;
}

export type ParsedChatFrame =
  | {
      kind: 'chat';
      parsed: ParsedInboundChatMessage;
      ackId?: string;
      thread: string;
      msgId: string;
      contentPreview: string;
    }
  | {
      kind: 'desktop-ready';
      eventData: Record<string, unknown>;
      ackId?: string;
    }
  | {
      kind: 'call-frame';
      action: 'incoming' | 'answered' | 'ended' | 'declined';
      eventData: Record<string, unknown>;
      ackId?: string;
    }
  | {
      kind: 'reaction';
      parsed: ParsedReactionUpdate;
      ackId?: string;
      thread: string;
      msgId: string;
    }
  | {
      kind: 'filtered';
      reason: 'contact' | 'root' | 'cutoff';
      ackId?: string;
      /** Debug context — safe to log. */
      details: Record<string, unknown>;
    }
  | {
      kind: 'ignored';
      reason: 'thread';
      msgId: string;
      thread: string;
    }
  | {
      kind: 'error';
      error: string;
    };

export interface ParseChatSseFrameOptions {
  /** Drops frames whose `event.contact_id` doesn't match. Pass the user's
   *  contact id for the assistant. */
  myContactId: number;
  /** Drops unified chat-store frames for other users' assistant-DM threads.
   *  Pass the signed-in user's id. */
  myUserId?: string;
  /** Drops root-tagged frames from other contexts and stamps accepted messages. */
  sourceContext?: string;
  /** Root subscription key for accepted frames. */
  rootKey: string;
  /** Drops frames whose `publishTime` is strictly before this unix-ms.
   *  Pass `0` to disable. */
  cutoffMs: number;
}

interface RawFramePayload {
  event?: Record<string, unknown>;
  __ackId?: string;
  thread?: string;
  publishTime?: string;
  id?: string;
  content?: unknown;
  rawContent?: unknown;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  contact_id?: number;
  sourceContext?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  source_context?: string;
  context?: string;
}

/**
 * Parse one SSE frame's `data` payload. Pure: no side effects, no React,
 * no logging — callers decide whether / how to log each outcome.
 */
export function parseChatSseFrame(
  rawData: string,
  opts: ParseChatSseFrameOptions
): ParsedChatFrame {
  let payload: RawFramePayload & Record<string, unknown>;
  try {
    payload = JSON.parse(rawData);
  } catch (err) {
    return { kind: 'error', error: `parse: ${String(err)}` };
  }

  const ackId = payload.__ackId;
  const thread = (payload.thread as string | undefined) ?? 'none';
  const publishTimeStr = payload.publishTime;
  const msgId = payload.id ?? 'no-id';
  const eventObj = payload.event;

  // contact-id filter: when the payload carries an explicit contact_id it
  // must match the caller's. Frames without a contact_id bypass this check
  // (e.g. assistant_desktop_ready payloads have no per-contact routing).
  const messageContactId = (eventObj?.contact_id as number | undefined) ?? payload.contact_id;
  if (messageContactId !== undefined && messageContactId !== opts.myContactId) {
    return {
      kind: 'filtered',
      reason: 'contact',
      ackId,
      details: { msgId, msgContact: messageContactId, myContact: opts.myContactId },
    };
  }

  const messageSourceContext =
    (eventObj?.sourceContext as string | undefined) ??
    (eventObj?.source_context as string | undefined) ??
    (eventObj?.context as string | undefined) ??
    payload.sourceContext ??
    payload.source_context ??
    payload.context;
  if (
    typeof messageSourceContext === 'string' &&
    opts.sourceContext &&
    messageSourceContext !== opts.sourceContext
  ) {
    return {
      kind: 'filtered',
      reason: 'root',
      ackId,
      details: {
        msgId,
        msgSourceContext: messageSourceContext,
        mySourceContext: opts.sourceContext,
      },
    };
  }

  // Lifecycle events are idempotent and not chat history — never apply the
  // transcript cutoff (self-host desktop_ready can predate voice-call lines).
  if (thread === 'assistant_desktop_ready') {
    return {
      kind: 'desktop-ready',
      ackId,
      eventData: (eventObj ?? {}) as Record<string, unknown>,
    };
  }

  // Call session signaling for assistant_dm calls (the assistant ringing its
  // human, answers, ends). Like desktop-ready these are idempotent lifecycle
  // signals, not chat history, so they never apply the transcript cutoff.
  if (typeof thread === 'string' && thread.startsWith('call_')) {
    const action = thread.slice('call_'.length);
    if (
      action === 'incoming' ||
      action === 'answered' ||
      action === 'ended' ||
      action === 'declined'
    ) {
      return {
        kind: 'call-frame',
        action,
        ackId,
        eventData: (eventObj ?? {}) as Record<string, unknown>,
      };
    }
    return { kind: 'ignored', reason: 'thread', msgId, thread };
  }

  // Unified chat-store frames carry the DM thread's human party as
  // `user_id`; drop frames for other users' assistant-DM threads.
  if (thread === 'chat_message' || thread === 'chat_reaction') {
    const kind = eventObj?.kind;
    if (kind !== 'assistant_dm') {
      return { kind: 'ignored', reason: 'thread', msgId, thread };
    }
    const threadUserId = eventObj?.user_id as string | undefined;
    if (opts.myUserId && threadUserId && threadUserId !== opts.myUserId) {
      return {
        kind: 'filtered',
        reason: 'contact',
        ackId,
        details: { msgId, msgUser: threadUserId, myUser: opts.myUserId },
      };
    }
  }

  if (thread === 'chat_reaction') {
    const targetMessageId = Number(eventObj?.id);
    if (!Number.isFinite(targetMessageId)) {
      return { kind: 'error', error: 'chat_reaction: missing message id' };
    }
    const reactions = mapTranscriptReactions({ reactions: eventObj?.reactions }) ?? [];
    return {
      kind: 'reaction',
      ackId,
      thread,
      msgId: String(targetMessageId),
      parsed: {
        targetMessageId,
        contactId: opts.myContactId,
        emoji: null,
        action: 'changed',
        reactions,
        rootKey: opts.rootKey,
        sourceContext: opts.sourceContext,
        publishTime: publishTimeStr,
      },
    };
  }

  if (thread === 'unify_message_reaction_outbound') {
    const targetMessageId = Number(eventObj?.target_message_id ?? eventObj?.targetMessageId);
    if (!Number.isFinite(targetMessageId)) {
      return { kind: 'error', error: 'reaction: missing target_message_id' };
    }
    const rawReactions = eventObj?.reactions;
    const reactions =
      mapTranscriptReactions({ reactions: rawReactions }) ??
      (Array.isArray(rawReactions) ? (rawReactions as MessageReaction[]) : []);
    const emojiRaw = eventObj?.emoji;
    const emoji = typeof emojiRaw === 'string' && emojiRaw.trim() ? emojiRaw : null;
    const actionRaw = eventObj?.action;
    const action =
      actionRaw === 'removed' || actionRaw === 'changed' || actionRaw === 'added'
        ? actionRaw
        : emoji
          ? 'added'
          : 'removed';

    return {
      kind: 'reaction',
      ackId,
      thread,
      msgId: String(targetMessageId),
      parsed: {
        targetMessageId,
        contactId: opts.myContactId,
        emoji,
        action,
        reactions,
        rootKey: opts.rootKey,
        sourceContext: opts.sourceContext,
        publishTime: publishTimeStr,
      },
    };
  }

  // cutoff filter: client-recorded high-water mark for already-seen history.
  // Anything strictly older is a redelivery of a message we already rendered
  // via the REST transcript fetch, so drop it (and ack so Pub/Sub stops
  // redelivering).
  if (publishTimeStr && opts.cutoffMs > 0) {
    const msgTime = new Date(publishTimeStr).getTime();
    if (msgTime < opts.cutoffMs) {
      return {
        kind: 'filtered',
        reason: 'cutoff',
        ackId,
        details: {
          msgId,
          publishTime: publishTimeStr,
          ageMs: Date.now() - msgTime,
          cutoff: new Date(opts.cutoffMs).toISOString(),
          cutoffAgeMs: Date.now() - opts.cutoffMs,
          thread,
        },
      };
    }
  }

  if (thread === 'chat_message') {
    const storeMessageId = Number(eventObj?.id);
    const hasServerMessageId = Number.isFinite(storeMessageId);
    const serverMsgId = hasServerMessageId ? String(storeMessageId) : uuidv4();
    const senderKind = eventObj?.sender_kind;
    const timestampRaw = (eventObj?.timestamp as string | undefined) ?? publishTimeStr;
    const timestamp = new Date(timestampRaw || new Date().toISOString());

    const rawAttachments = eventObj?.attachments as unknown;
    const attachments: Attachment[] | undefined = Array.isArray(rawAttachments)
      ? rawAttachments.map((a: Record<string, unknown>) => {
          const camel = snakeToCamelObject<Record<string, unknown>>(a);
          return {
            id: (camel.id as string) || uuidv4(),
            filename: (camel.filename as string) || 'attachment',
            gsUrl: camel.gsUrl as string | undefined,
            contentType: camel.contentType as string | undefined,
            sizeBytes: camel.sizeBytes as number | undefined,
          } satisfies Attachment;
        })
      : undefined;

    const message: ChatMessage = {
      id: serverMsgId,
      role: senderKind === 'assistant' ? 'assistant' : 'user',
      content: String(eventObj?.content ?? ''),
      timestamp,
      ...(hasServerMessageId ? { messageId: storeMessageId } : {}),
      reactions: mapTranscriptReactions({ reactions: eventObj?.reactions }),
      __ackId: ackId,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    return {
      kind: 'chat',
      ackId,
      thread,
      msgId: serverMsgId,
      contentPreview: String(eventObj?.content ?? '').slice(0, 60),
      parsed: {
        message,
        contactId: opts.myContactId,
        rootKey: opts.rootKey,
        sourceContext: opts.sourceContext,
        publishTime: publishTimeStr,
        hasServerMessageId,
      },
    };
  }

  if (thread === 'unify_message_outbound') {
    const content =
      (eventObj?.content as unknown) ??
      (eventObj?.body as unknown) ??
      payload.content ??
      payload.rawContent ??
      '';
    const incomingId = payload.id;
    const hasServerMessageId = Boolean(incomingId);
    const serverMsgId = incomingId || uuidv4();
    const timestamp = new Date(publishTimeStr || new Date().toISOString());

    const rawAttachments = eventObj?.attachments as unknown;
    const attachments: Attachment[] | undefined = Array.isArray(rawAttachments)
      ? rawAttachments.map((a: Record<string, unknown>) => {
          const camel = snakeToCamelObject<Record<string, unknown>>(a);
          return {
            id: (camel.id as string) || uuidv4(),
            filename: (camel.filename as string) || 'attachment',
            gsUrl: camel.gsUrl as string | undefined,
            contentType: camel.contentType as string | undefined,
            sizeBytes: camel.sizeBytes as number | undefined,
          } satisfies Attachment;
        })
      : undefined;

    const message: ChatMessage = {
      id: serverMsgId,
      role: 'assistant',
      content: String(content),
      timestamp,
      sourceContext: opts.sourceContext,
      __ackId: ackId,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    const contentPreview = String((eventObj?.content as unknown) ?? payload.content ?? '').slice(
      0,
      60
    );

    return {
      kind: 'chat',
      ackId,
      thread,
      msgId: serverMsgId,
      contentPreview,
      parsed: {
        message,
        contactId: opts.myContactId,
        rootKey: opts.rootKey,
        sourceContext: opts.sourceContext,
        publishTime: publishTimeStr,
        hasServerMessageId,
      },
    };
  }

  return { kind: 'ignored', reason: 'thread', msgId, thread };
}
