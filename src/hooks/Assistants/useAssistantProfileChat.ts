import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, BroadcastMessagePayload, Attachment } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { uploadAttachmentBatch, type BatchUploadHandle } from '@/components/Chat/attachmentUtils';
import {
  getSessionContactId,
  setSessionContactId,
  getOrFetchContactId,
  getOrFetchTranscripts,
} from './useContactIdPrefetch';
import { clientLog, setLogContext } from '@/lib/logging/client-log-buffer';
import type { ChatStreamConnectionStatus } from './useAssistantChatStream';

/**
 * Chat initialization follows a linear phase progression:
 *
 *   uninitialized ──► pending_contact ──────────────────► ready
 *                      (first view or returning;           (SSE connects)
 *                       skip transcript fetch)
 *
 *   uninitialized ──► resolving_contact ──► loading_transcripts ──► ready
 *                      (fresh load;          (fetch from backend)
 *                       need transcripts)
 *
 * The "should I fetch transcripts?" decision is structural — encoded in the
 * phase transition — not conditional on a mutable ref. This eliminates the
 * class of race conditions where concurrent async paths disagree on whether
 * to fetch.
 */
type ChatPhase =
  | 'uninitialized'
  | 'pending_contact'
  | 'resolving_contact'
  | 'loading_transcripts'
  | 'ready'
  | 'error';

const CONTACT_ID_RETRY_BASE_DELAY = 500;
const CONTACT_ID_RETRY_MAX_DELAY = 16000;
const CONTACT_ID_MAX_RETRIES = 6;

/**
 * Panel-side chat hook.
 *
 * The page-level `useAssistantChatStream` owns the transport for every
 * assistant in the workspace; this hook no longer opens its own SSE. Instead
 * the caller passes down the current connection status, a reconnect handle,
 * and a per-assistant "activity counter" that bumps on every inbound SSE
 * frame. Everything panel-specific (contact-id resolution, transcript
 * loading, send, typing indicator, cross-tab BroadcastChannel receive)
 * stays here.
 */
export interface ChatStreamPanelLink {
  /** Current SSE health for the page-level chat stream. */
  connectionStatus: ChatStreamConnectionStatus;
  /** Force a reconnect of the page-level chat stream. */
  reconnect: () => void;
  /**
   * Monotonic counter bumped on every inbound SSE frame for *this* assistant.
   * Used as a signal to clear the typing indicator; the panel does not read
   * the absolute value, only changes to it.
   */
  activitySignal: number;
}

export function useAssistantProfileChat(
  assistant: Assistant | null,
  assistantActions: Pick<AssistantActions, 'chat'>,
  chatHistories: Record<string, ChatMessage[]>,
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>,
  userEmail: string | null | undefined,
  chatStream: ChatStreamPanelLink,
  isFirstView?: boolean,
  preHireChat?: ChatMessage[],
  onFirstViewCompleted?: () => void
) {
  const assistantId = assistant?.agentId || null;

  const messages = React.useMemo(() => {
    const raw = assistantId ? chatHistories[assistantId] || [] : [];
    return [...raw].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [chatHistories, assistantId]);

  // =========================================================================
  // Phase state machine
  // =========================================================================
  const [phase, setPhase] = React.useState<ChatPhase>('uninitialized');
  const [contactId, setContactId] = React.useState<number | null>(null);
  const [initialLoadError, setInitialLoadError] = React.useState(false);
  const [canChat, setCanChat] = React.useState(true);
  const [isRetryingContactId, setIsRetryingContactId] = React.useState(false);
  const initDoneRef = React.useRef(false);
  // Tracks which assistantId the current phase/contactId belong to. Prevents
  // the SSE effect from creating a spurious connection during the render where
  // assistantId has changed but phase/contactId haven't been reset yet.
  const activeAssistantIdRef = React.useRef<string | null>(null);
  // Session-wide cache so switching back to a previously-viewed assistant
  // doesn't re-resolve contactId (avoids "Connecting..." flash on every switch).
  const contactIdCacheRef = React.useRef<Map<string, number>>(new Map());

  // =========================================================================
  // Orthogonal UI state
  // =========================================================================
  const [inputValue, setInputValue] = React.useState('');
  const [isAssistantReplying, setIsAssistantReplying] = React.useState(false);
  const [hasMoreMessages, setHasMoreMessages] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [hasFetchedHistory, setHasFetchedHistory] = React.useState(false);

  const typingDelayTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const uploadHandleRef = React.useRef<BatchUploadHandle | null>(null);
  const sendGenerationRef = React.useRef(0);

  // =========================================================================
  // Reset when assistant changes
  // =========================================================================
  React.useEffect(() => {
    if (assistantId) {
      clientLog('CHAT_OPENED', { assistant: assistantId, userEmail: userEmail ?? 'unknown' });
      setLogContext({ assistantId, userEmail: userEmail ?? undefined });
    }
    setPhase('uninitialized');
    setContactId(null);
    setInitialLoadError(false);
    setCanChat(true);
    setIsRetryingContactId(false);
    setHasMoreMessages(true);
    setHasFetchedHistory(false);
    setLoadMoreError(false);
    initDoneRef.current = false;
    // Reset the typing indicator too. `AssistantProfileChatPanel` is
    // rendered without a React `key` on `assistantId`, so React reuses this
    // hook instance across assistant switches; without this reset, a
    // `setIsAssistantReplying(true)` that fired for the previous assistant
    // would still be truthy on the newly-selected one and render the "…"
    // bubble in their chat until the 20 s auto-clear timer elapses.
    if (typingDelayTimerRef.current) {
      clearTimeout(typingDelayTimerRef.current);
      typingDelayTimerRef.current = null;
    }
    if (typingTimeoutTimerRef.current) {
      clearTimeout(typingTimeoutTimerRef.current);
      typingTimeoutTimerRef.current = null;
    }
    setIsAssistantReplying(false);
    return () => {
      if (assistantId) clientLog('CHAT_CLOSED', { assistant: assistantId });
    };
  }, [assistantId, userEmail]);

  // =========================================================================
  // Typing helpers
  // =========================================================================
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const clearTimers = React.useCallback(() => {
    if (typingDelayTimerRef.current) {
      clearTimeout(typingDelayTimerRef.current);
      typingDelayTimerRef.current = null;
    }
    if (typingTimeoutTimerRef.current) {
      clearTimeout(typingTimeoutTimerRef.current);
      typingTimeoutTimerRef.current = null;
    }
  }, []);

  const stopReplying = React.useCallback(() => {
    clearTimers();
    setIsAssistantReplying(false);
  }, [clearTimers]);

  React.useEffect(() => {
    if (isAssistantReplying) {
      typingTimeoutTimerRef.current = setTimeout(() => {
        setIsAssistantReplying(false);
      }, 20000);
    }
    return () => {
      if (typingTimeoutTimerRef.current) clearTimeout(typingTimeoutTimerRef.current);
    };
  }, [isAssistantReplying]);

  // =========================================================================
  // Phase 1: Initialization
  // Determines starting phase based on isFirstView and existing history.
  // Runs exactly once per assistant (gated on phase === 'uninitialized').
  // =========================================================================
  React.useEffect(() => {
    // Gate on userEmail so the sessionStorage lookup uses the correct
    // email-scoped key. Without this, the effect can fire before the
    // session loads (userEmail = null), causing a key mismatch:
    //   null  → "assistant_contact_id:702"          (WRONG)
    //   email → "assistant_contact_id:user@x:702"   (CORRECT)
    // When userEmail later arrives, Phase 1 re-fires (it's in deps).
    if (phase !== 'uninitialized' || !assistantId || !assistant || !userEmail) return;

    activeAssistantIdRef.current = assistantId;

    // Check in-memory cache first, then sessionStorage fallback
    let cachedId = contactIdCacheRef.current.get(assistantId);
    if (cachedId === undefined) {
      cachedId = getSessionContactId(assistantId, userEmail);
      if (cachedId !== undefined) {
        // Promote sessionStorage hit into the in-memory cache
        contactIdCacheRef.current.set(assistantId, cachedId);
      }
    }

    if (isFirstView && !initDoneRef.current) {
      initDoneRef.current = true;
      const initialHistory = preHireChat || [];
      clientLog('PHASE', {
        from: 'uninitialized',
        to: 'ready',
        reason: 'first_view',
        preHireMsgCount: initialHistory.length,
      });
      setChatHistories((prev) => ({ ...prev, [assistantId]: initialHistory }));
      onFirstViewCompleted?.();
      const ownerId = cachedId ?? assistant.bossContactId;
      contactIdCacheRef.current.set(assistantId, ownerId);
      setSessionContactId(assistantId, ownerId, userEmail);
      setContactId(ownerId);
      setPhase('ready');
    } else if (chatHistories[assistantId] !== undefined) {
      if (cachedId !== undefined) {
        clientLog('PHASE', {
          from: 'uninitialized',
          to: 'ready',
          reason: 'history_exists',
          contactSource: 'cache',
          historyLen: chatHistories[assistantId]?.length ?? 0,
        });
        setContactId(cachedId);
        setPhase('ready');
      } else {
        clientLog('PHASE', {
          from: 'uninitialized',
          to: 'pending_contact',
          reason: 'history_exists_no_contact',
        });
        setPhase('pending_contact');
      }
    } else {
      if (cachedId !== undefined) {
        clientLog('PHASE', {
          from: 'uninitialized',
          to: 'loading_transcripts',
          reason: 'no_history',
          contactSource: 'cache',
        });
        setContactId(cachedId);
        setPhase('loading_transcripts');
      } else {
        clientLog('PHASE', {
          from: 'uninitialized',
          to: 'resolving_contact',
          reason: 'no_history_no_contact',
        });
        setPhase('resolving_contact');
      }
    }
    // isFirstView, preHireChat, onFirstViewCompleted are consumed once during the
    // uninitialized→* transition. They must NOT be dependencies — the effect should
    // not re-run when the parent re-renders with a new onFirstViewCompleted ref.
    // userEmail IS a dep: Phase 1 must wait for the session email so the
    // sessionStorage lookup uses the correct key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, assistantId, assistant, userEmail, setChatHistories]);

  // =========================================================================
  // Phase 2: Contact ID resolution
  // Polls getContactId with retries inside a single effect. The cleanup
  // function cancels in-flight requests and timers — proper React lifecycle,
  // no orphaned callbacks.
  // =========================================================================
  React.useEffect(() => {
    if (phase !== 'pending_contact' && phase !== 'resolving_contact') return;
    if (!assistantId || !assistant) return;

    if (!userEmail) {
      clientLog('PHASE', { from: phase, to: 'error', reason: 'no_email' });
      setCanChat(false);
      setInitialLoadError(true);
      setPhase('error');
      return;
    }

    const prefetchedId = getSessionContactId(assistantId, userEmail);
    if (prefetchedId !== undefined) {
      contactIdCacheRef.current.set(assistantId, prefetchedId);
      setContactId(prefetchedId);
      setCanChat(true);
      const nextPhase = phase === 'pending_contact' ? 'ready' : 'loading_transcripts';
      clientLog('CONTACT_RESOLVED', { contactId: prefetchedId, source: 'session_prefetch' });
      clientLog('PHASE', { from: phase, to: nextPhase, reason: 'prefetch_hit' });
      if (phase === 'pending_contact') {
        setPhase('ready');
      } else {
        setPhase('loading_transcripts');
      }
      return;
    }

    let cancelled = false;
    let retryTimer: NodeJS.Timeout;
    const currentAssistantId = assistantId;
    const currentAssistant = assistant;
    const skipTranscripts = phase === 'pending_contact';

    const resolve = async (attempt: number) => {
      try {
        // getOrFetchContactId deduplicates with the prefetch hook: if a
        // prefetch request is already in-flight for this assistant, we
        // piggyback on it instead of firing a redundant API call.
        const id = await getOrFetchContactId(
          assistantActions.chat.getContactId,
          userEmail,
          currentAssistant
        );
        if (cancelled) return;

        if (id !== null) {
          clientLog('CONTACT_RESOLVED', { contactId: id, source: 'api', attempt });
          contactIdCacheRef.current.set(currentAssistantId, id);
          setSessionContactId(currentAssistantId, id, userEmail);
          setContactId(id);
          setCanChat(true);
          setIsRetryingContactId(false);
          const nextPhase = skipTranscripts ? 'ready' : 'loading_transcripts';
          clientLog('PHASE', { from: phase, to: nextPhase, reason: 'contact_resolved' });
          if (skipTranscripts) {
            setPhase('ready');
          } else {
            setPhase('loading_transcripts');
          }
        } else if (attempt < CONTACT_ID_MAX_RETRIES) {
          setCanChat(false);
          setIsRetryingContactId(true);
          const delay = Math.min(
            CONTACT_ID_RETRY_BASE_DELAY * Math.pow(2, attempt),
            CONTACT_ID_RETRY_MAX_DELAY
          );
          retryTimer = setTimeout(() => {
            if (!cancelled) resolve(attempt + 1);
          }, delay);
        } else {
          setCanChat(false);
          setIsRetryingContactId(false);
          setPhase('error');
        }
      } catch {
        if (cancelled) return;
        if (attempt < CONTACT_ID_MAX_RETRIES) {
          setCanChat(false);
          setIsRetryingContactId(true);
          const delay = Math.min(
            CONTACT_ID_RETRY_BASE_DELAY * Math.pow(2, attempt),
            CONTACT_ID_RETRY_MAX_DELAY
          );
          retryTimer = setTimeout(() => {
            if (!cancelled) resolve(attempt + 1);
          }, delay);
        } else {
          setCanChat(false);
          setIsRetryingContactId(false);
          setPhase('error');
        }
      }
    };

    resolve(0);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
    // assistantActions.chat and userEmail are stable across the resolution lifecycle.
    // phase drives re-entry; assistantId gates on the correct assistant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, assistantId]);

  // =========================================================================
  // Phase 3: Transcript loading
  // Only reachable from resolving_contact path, never from first-view or
  // returning. This is the structural guarantee that eliminates the race.
  // =========================================================================
  React.useEffect(() => {
    if (phase !== 'loading_transcripts' || contactId === null || !assistantId || !assistant) return;

    let cancelled = false;
    const currentAssistantId = assistantId;

    (async () => {
      try {
        // getOrFetchTranscripts deduplicates with the prefetch hook: if a
        // prefetch request is already in-flight for this assistant, we
        // piggyback on it instead of firing a redundant API call.
        const result = await getOrFetchTranscripts(
          assistantActions.chat.getTranscripts,
          contactId,
          assistant
        );
        if (cancelled) return;

        if ('detail' in result) {
          clientLog('PHASE', {
            from: 'loading_transcripts',
            to: 'error',
            reason: 'transcript_error',
            detail: (result as any).detail,
          });
          setInitialLoadError(true);
          setPhase('error');
        } else {
          const history = [...(result as ChatMessage[])].reverse();
          clientLog('TRANSCRIPTS_LOADED', { count: history.length, assistant: currentAssistantId });
          setChatHistories((prev) => ({ ...prev, [currentAssistantId]: history }));
          if (history.length < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
            setHasMoreMessages(false);
          }
          clientLog('PHASE', {
            from: 'loading_transcripts',
            to: 'ready',
            reason: 'transcripts_loaded',
          });
          setPhase('ready');
        }
      } catch {
        if (cancelled) return;
        clientLog('PHASE', {
          from: 'loading_transcripts',
          to: 'error',
          reason: 'transcript_exception',
        });
        setInitialLoadError(true);
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, contactId, assistantId]);

  // =========================================================================
  // Prefetch fast-path: short-circuit to 'ready' when prefetched data
  // becomes available during any loading/resolving phase.
  // =========================================================================
  // The prefetch hook uses direct fetch() (bypasses the server action queue)
  // and may write chatHistories + sessionStorage BEFORE Phase 2's or Phase
  // 3's server actions resolve.  When that happens the messages appear in
  // the UI but the input stays disabled because phase hasn't reached 'ready'.
  //
  // This effect monitors chatHistories and userEmail. When both the contact
  // ID (from sessionStorage / in-memory cache) and the transcript history
  // are available, it transitions straight to 'ready' — cancelling any
  // in-flight Phase 2/3 server actions via their cleanup functions.
  React.useEffect(() => {
    if (!assistantId || !userEmail) return;
    if (
      phase !== 'loading_transcripts' &&
      phase !== 'resolving_contact' &&
      phase !== 'pending_contact'
    )
      return;

    // Need transcripts to be prefetched
    if (chatHistories[assistantId] === undefined) return;

    // Need contact ID (in-memory cache or sessionStorage)
    let cachedId = contactIdCacheRef.current.get(assistantId);
    if (cachedId === undefined) {
      cachedId = getSessionContactId(assistantId, userEmail);
      if (cachedId !== undefined) {
        contactIdCacheRef.current.set(assistantId, cachedId);
      }
    }
    if (cachedId === undefined) return;

    clientLog('PHASE', {
      from: phase,
      to: 'ready',
      reason: 'prefetch_fast_path',
      historyLen: chatHistories[assistantId]?.length ?? 0,
    });
    if ((chatHistories[assistantId]?.length ?? 0) < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
      setHasMoreMessages(false);
    }
    setContactId(cachedId);
    setCanChat(true);
    setPhase('ready');
  }, [phase, assistantId, chatHistories, userEmail]);

  // =========================================================================
  // Error recovery
  // =========================================================================
  const retryInitialLoad = React.useCallback(() => {
    if (!assistantId || !assistant) return;
    setInitialLoadError(false);
    setIsRetryingContactId(false);
    if (contactId !== null) {
      setPhase('loading_transcripts');
    } else if (chatHistories[assistantId] !== undefined) {
      setPhase('pending_contact');
    } else {
      setPhase('resolving_contact');
    }
  }, [assistantId, assistant, contactId, chatHistories]);

  // =========================================================================
  // Pagination
  // =========================================================================
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !assistant || !assistantId || !canChat) return;
    if (contactId === null) return;

    const oldestMessage = messages[0];
    if (!oldestMessage) {
      setHasMoreMessages(false);
      return;
    }

    setLoadMoreError(false);
    setIsLoadingMore(true);
    try {
      const result = await assistantActions.chat.getTranscripts(contactId, assistant, {
        timestamp: oldestMessage.timestamp.toISOString(),
        excludedKeys: messages.map(
          (message) =>
            message.mergeKey ?? `${message.sourceContext ?? ''}:${message.messageId ?? message.id}`
        ),
      });
      setHasFetchedHistory(true);
      if ('detail' in result) {
        setLoadMoreError(true);
      } else {
        const newMessages = (result as ChatMessage[]).reverse();
        if (newMessages.length < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
          setHasMoreMessages(false);
        }
        setChatHistories((prev) => {
          const current = prev[assistantId] || [];
          const existingIds = new Set(current.map((m) => m.mergeKey ?? m.id));
          const uniqueNewMessages = newMessages.filter((m) => !existingIds.has(m.mergeKey ?? m.id));
          return { ...prev, [assistantId]: [...uniqueNewMessages, ...current] };
        });
      }
    } catch (error) {
      setLoadMoreError(true);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // =========================================================================
  // Cross-tab sync via BroadcastChannel
  // =========================================================================
  React.useEffect(() => {
    if (!assistantId) return;
    const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
    channel.onmessage = (event) => {
      const payload = event.data as BroadcastMessagePayload;
      if (!payload || !payload.message || !payload.message.id) return;
      const incomingMsg = payload.message;
      const messageWithDate = {
        ...incomingMsg,
        timestamp: new Date(incomingMsg.timestamp),
      };
      clientLog('BROADCAST_RECV', {
        msgId: incomingMsg.id,
        role: incomingMsg.role,
        content: String(incomingMsg.content).slice(0, 40),
      });
      setChatHistories((prev) => {
        const current = prev[assistantId] || [];
        if (current.some((m) => m.id === messageWithDate.id)) {
          clientLog('BROADCAST_DEDUP', { msgId: incomingMsg.id });
          return prev;
        }
        let finalMsg = messageWithDate;
        if (messageWithDate.role === 'user' && current.length > 0) {
          const lastTs = Math.max(...current.map((m) => new Date(m.timestamp).getTime()));
          const msgTs = new Date(messageWithDate.timestamp).getTime();
          if (msgTs <= lastTs) {
            clientLog('BROADCAST_CLAMP', {
              msgId: incomingMsg.id,
              original: new Date(msgTs).toISOString(),
              clamped: new Date(lastTs + 1).toISOString(),
            });
            finalMsg = { ...messageWithDate, timestamp: new Date(lastTs + 1) };
          }
        }
        const updated = [...current, finalMsg].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return { ...prev, [assistantId]: updated };
      });
    };
    return () => {
      channel.close();
    };
  }, [assistantId, setChatHistories]);

  // =========================================================================
  // Chat SSE stream
  //
  // The transport (open/close/parse/filter/reconnect/desktop-ready) lives at
  // the page level in `useAssistantChatStream`, which delivers every parsed
  // message directly into `chatHistories` via the page's `onChatMessage`
  // handler. This hook observes two derived signals from that stream:
  //
  //   1. `connectionStatus` / `reconnect` — surfaced unchanged so the panel
  //      header indicator and the "retry" button keep working.
  //   2. `activitySignal` — a monotonic counter the page bumps on every
  //      inbound frame for *this* assistant. When it ticks, we treat the
  //      assistant as no longer "thinking" and clear the typing bubble.
  // =========================================================================
  const { connectionStatus, reconnect: reconnectSSE, activitySignal } = chatStream;

  const lastActivitySignalRef = React.useRef(activitySignal);
  React.useEffect(() => {
    // Rebaseline on assistant switch so the switch itself (where the signal
    // value jumps to the new assistant's counter) isn't mistaken for
    // real-time activity on the newly-open chat.
    lastActivitySignalRef.current = activitySignal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantId]);
  React.useEffect(() => {
    if (activitySignal > lastActivitySignalRef.current) {
      stopReplying();
    }
    lastActivitySignalRef.current = activitySignal;
  }, [activitySignal, stopReplying]);

  // The polling fallback that used to live here has moved to the page-level
  // `useAssistantTranscriptReconciler` (see `Main.tsx`). The reconciler
  // covers every assistant in the workspace — not just the active panel —
  // so backgrounded chats whose Pub/Sub subscription dies still have their
  // unread badge stay accurate, and we don't pay the cost twice when both
  // the chat panel and the call dialog's side panel are open for the same
  // assistant. Cadence there adapts to the per-assistant SSE health.

  // =========================================================================
  // Send message
  // =========================================================================
  const sendMessage = (
    e: React.FormEvent,
    attachments?: Attachment[],
    setPendingAttachments?: React.Dispatch<React.SetStateAction<Attachment[]>>
  ) => {
    e.preventDefault();

    const hasContent = inputValue.trim() || (attachments && attachments.length > 0);
    if (
      !hasContent ||
      phase !== 'ready' ||
      initialLoadError ||
      !assistant ||
      !assistantId ||
      !canChat
    )
      return;

    if (contactId === null) {
      toast.error('Cannot send message: not connected to assistant');
      return;
    }

    const currentAssistantId = assistantId;
    const currentAssistant = assistant;
    const currentContactId = contactId;

    clearTimers();
    const generation = ++sendGenerationRef.current;

    const messageToSend = inputValue.trim();

    const failedIds = new Set<string>();

    const isStale = () => generation !== sendGenerationRef.current;

    const updateChipStatus = (id: string, status: Attachment['uploadStatus']) => {
      if (isStale()) return;
      if (status === 'error') failedIds.add(id);
      setPendingAttachments?.((prev) =>
        prev.map((a) => (a.id === id ? { ...a, uploadStatus: status } : a))
      );
    };

    const sendMessageWithAttachments = async () => {
      try {
        let uploadedAttachments: Attachment[] | undefined;

        if (attachments && attachments.length > 0) {
          const handle = uploadAttachmentBatch(attachments, currentAssistant.agentId, {
            onStatusChange: updateChipStatus,
            onUploaded: (id, result) => {
              if (isStale()) return;
              setPendingAttachments?.((prev) =>
                prev.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        gsUrl: result.gsUrl,
                        contentType: result.contentType,
                        sizeBytes: result.sizeBytes,
                      }
                    : a
                )
              );
            },
          });
          uploadHandleRef.current = handle;
          const succeeded = await handle.promise;
          uploadHandleRef.current = null;

          if (generation !== sendGenerationRef.current) return;

          if (failedIds.size > 0) {
            const failedCount = failedIds.size;
            toast.error(`${failedCount} attachment${failedCount > 1 ? 's' : ''} failed to upload`);
          }

          // Clear succeeded chips, keep failed ones with error status and remove buttons
          setPendingAttachments?.((prev) => prev.filter((a) => failedIds.has(a.id)));

          if (succeeded.length > 0) {
            uploadedAttachments = succeeded;
          }
        } else {
          setPendingAttachments?.([]);
        }

        const hasMessageContent =
          messageToSend || (uploadedAttachments && uploadedAttachments.length > 0);
        if (!hasMessageContent) {
          setInputValue(messageToSend);
          stopReplying();
          return;
        }

        // -- Uploads done, chips cleaned up. From here, failures should NOT restore attachments. --

        const messageId = uuidv4();
        const newUserMessage: ChatMessage = {
          id: messageId,
          role: 'user',
          content: messageToSend,
          timestamp: new Date(),
          attachments: uploadedAttachments?.map((a) => ({
            id: a.id,
            filename: a.filename,
            gsUrl: a.gsUrl,
            contentType: a.contentType,
            sizeBytes: a.sizeBytes,
          })),
        };

        // Clamp the optimistic timestamp inside the updater so it always
        // sorts after every existing message. This prevents client-server
        // clock skew from placing the message before recent server-
        // timestamped messages. The updater's `prev` is guaranteed to
        // include prior queued sends (React processes functional updaters
        // sequentially), so rapid successive sends each get a distinct,
        // monotonically increasing timestamp.
        let clampedMessage = newUserMessage;
        clientLog('SEND_OPTIMISTIC', {
          msgId: messageId,
          content: messageToSend.slice(0, 60),
          attachments: uploadedAttachments?.length ?? 0,
        });
        setChatHistories((prev) => {
          const current = prev[currentAssistantId] || [];
          const lastTs =
            current.length > 0
              ? Math.max(...current.map((m) => new Date(m.timestamp).getTime()))
              : 0;
          const msgTs = new Date(newUserMessage.timestamp).getTime();
          const clampedTs = new Date(Math.max(msgTs, lastTs + 1));
          clampedMessage = { ...newUserMessage, timestamp: clampedTs };
          return { ...prev, [currentAssistantId]: [...current, clampedMessage] };
        });
        setInputValue('');

        setIsAssistantReplying(true);

        const channel = new BroadcastChannel(`assistant-chat-sync-${currentAssistantId}`);
        const payload: BroadcastMessagePayload = {
          type: 'NEW_MESSAGE',
          message: clampedMessage,
        };
        channel.postMessage(payload);
        channel.close();

        try {
          const response = await assistantActions.chat.message({
            assistantId: parseInt(currentAssistant.agentId),
            contactId: currentContactId,
            message: messageToSend,
            attachments: uploadedAttachments,
          });

          if (response.detail) {
            throw new Error(response.detail);
          }
          clientLog('SEND_OK', { msgId: messageId });
        } catch (sendError) {
          const errorMsg =
            sendError instanceof Error ? sendError.message : 'Failed to send message.';
          clientLog('SEND_ROLLBACK', { msgId: messageId, error: errorMsg });
          setChatHistories((prev) => ({
            ...prev,
            [currentAssistantId]: (prev[currentAssistantId] || []).filter(
              (msg) => msg.id !== messageId
            ),
          }));
          setInputValue(messageToSend);
          stopReplying();
          toast.error(errorMsg);
        }
      } catch (error) {
        // Upload-phase failure — restore attachments so user can retry
        setInputValue(messageToSend);
        stopReplying();
        const errorMsg = error instanceof Error ? error.message : 'Failed to send message.';
        toast.error(errorMsg);

        if (attachments && attachments.length > 0) {
          setPendingAttachments?.(attachments.map((a) => ({ ...a, uploadStatus: undefined })));
        }
      }
    };

    sendMessageWithAttachments();
  };

  // =========================================================================
  // Cancel in-flight upload
  // =========================================================================
  const cancelSend = React.useCallback(() => {
    sendGenerationRef.current++;
    uploadHandleRef.current?.cancel();
    uploadHandleRef.current = null;
    stopReplying();
  }, [stopReplying]);

  // =========================================================================
  // Return backward-compatible API
  // =========================================================================
  return {
    messages,
    inputValue,
    isLoading: phase === 'resolving_contact' || phase === 'loading_transcripts',
    initialLoadError,
    retryInitialLoad,
    isAssistantReplying,
    handleInputChange,
    setInputValue,
    sendMessage,
    cancelSend,
    connectionStatus,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore,
    loadMoreError,
    hasFetchedHistory,
    canChat,
    isRetryingContactId,
    currentContactId: contactId,
    reconnectSSE,
  };
}
