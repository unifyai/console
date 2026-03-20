import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, BroadcastMessagePayload, Attachment } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { uploadAttachmentBatch } from '@/components/Chat/attachmentUtils';
import { snakeToCamelObject } from '@/utils/casing';
import { getSessionContactId, setSessionContactId, getOrFetchContactId, getOrFetchTranscripts } from './useContactIdPrefetch';

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

// Exponential backoff: 500ms → 1s → 2s → 4s → 8s → 16s (total ≈ 31.5s)
// The owner (person who hired the assistant) always gets contact ID 1.
// 0 = assistant AI, 1 = owner, 2+ = other contacts.
const OWNER_CONTACT_ID = 1;

const CONTACT_ID_RETRY_BASE_DELAY = 500;
const CONTACT_ID_RETRY_MAX_DELAY = 16000;
const CONTACT_ID_MAX_RETRIES = 6;


export function useAssistantProfileChat(
  assistant: Assistant | null,
  assistantActions: Pick<AssistantActions, 'chat'>,
  chatHistories: Record<string, ChatMessage[]>,
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>,
  userEmail: string | null | undefined,
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
  const [connectionStatus, setConnectionStatus] = React.useState<
    'connecting' | 'connected' | 'reconnecting' | 'error'
  >('connecting');
  const [hasMoreMessages, setHasMoreMessages] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [hasFetchedHistory, setHasFetchedHistory] = React.useState(false);

  const typingDelayTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const transcriptCutoffsRef = React.useRef<Record<string, number>>({});

  // SSE reconnection state
  const [sseReconnectTrigger, setSseReconnectTrigger] = React.useState(0);
  const sseReconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const sseReconnectAttemptsRef = React.useRef(0);
  const SSE_MAX_RECONNECT_ATTEMPTS = 5;
  const SSE_RECONNECT_BASE_DELAY = 1000;


  // =========================================================================
  // Reset when assistant changes
  // =========================================================================
  React.useEffect(() => {
    setPhase('uninitialized');
    setContactId(null);
    setInitialLoadError(false);
    setCanChat(true);
    setIsRetryingContactId(false);
    setHasMoreMessages(true);
    setHasFetchedHistory(false);
    setLoadMoreError(false);
    setConnectionStatus('connecting');
    initDoneRef.current = false;
  }, [assistantId]);

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

  const recordTranscriptTimestamp = React.useCallback((id: string, msgs: ChatMessage[]) => {
    if (msgs.length > 0) {
      const maxTime = Math.max(...msgs.map((m) => new Date(m.timestamp).getTime()));
      if (!transcriptCutoffsRef.current[id] || maxTime > transcriptCutoffsRef.current[id]) {
        transcriptCutoffsRef.current[id] = maxTime;
      }
    } else if (!transcriptCutoffsRef.current[id]) {
      transcriptCutoffsRef.current[id] = 0;
    }
  }, []);

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
      recordTranscriptTimestamp(assistantId, initialHistory);
      setChatHistories((prev) => ({ ...prev, [assistantId]: initialHistory }));
      onFirstViewCompleted?.();
      // The hiring user is ALWAYS contact ID 1 (owner). The SSE endpoint
      // and message webhook don't validate that the contact record exists
      // in the Contacts table — they only use the ID as a namespace. So
      // we can skip resolution entirely and go straight to 'ready'.
      const ownerId = cachedId ?? OWNER_CONTACT_ID;
      contactIdCacheRef.current.set(assistantId, ownerId);
      setSessionContactId(assistantId, ownerId, userEmail);
      setContactId(ownerId);
      setPhase('ready');
    } else if (chatHistories[assistantId] !== undefined) {
      // History already exists — either from a previous view or from the
      // prefetch hook writing transcripts on page load. Record a proper
      // cutoff so the SSE filter discards backlog messages that are already
      // in the transcript history.
      if (!transcriptCutoffsRef.current[assistantId]) {
        recordTranscriptTimestamp(assistantId, chatHistories[assistantId] || []);
      }
      if (cachedId !== undefined) {
        setContactId(cachedId);
        setPhase('ready');
      } else {
        setPhase('pending_contact');
      }
    } else {
      if (cachedId !== undefined) {
        setContactId(cachedId);
        setPhase('loading_transcripts');
      } else {
        setPhase('resolving_contact');
      }
    }
    // isFirstView, preHireChat, onFirstViewCompleted are consumed once during the
    // uninitialized→* transition. They must NOT be dependencies — the effect should
    // not re-run when the parent re-renders with a new onFirstViewCompleted ref.
    // userEmail IS a dep: Phase 1 must wait for the session email so the
    // sessionStorage lookup uses the correct key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, assistantId, assistant, userEmail, recordTranscriptTimestamp, setChatHistories]);

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
      setCanChat(false);
      setInitialLoadError(true);
      setPhase('error');
      return;
    }

    // Re-check sessionStorage — the prefetch hook may have written the
    // contact ID between the Phase 1 init check and this effect firing.
    const prefetchedId = getSessionContactId(assistantId, userEmail);
    if (prefetchedId !== undefined) {
      contactIdCacheRef.current.set(assistantId, prefetchedId);
      setContactId(prefetchedId);
      setCanChat(true);
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
          currentAssistant.userId,
          currentAssistantId
        );
        if (cancelled) return;

        if (id !== null) {
          contactIdCacheRef.current.set(currentAssistantId, id);
          setSessionContactId(currentAssistantId, id, userEmail);
          setContactId(id);
          setCanChat(true);
          setIsRetryingContactId(false);
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
          assistant.userId,
          currentAssistantId
        );
        if (cancelled) return;

        if ('detail' in result) {
          setInitialLoadError(true);
          setPhase('error');
        } else {
          // Use non-mutating reverse — the same result array may be shared
          // with the prefetch hook's .then() handler if they coalesced.
          const history = [...(result as ChatMessage[])].reverse();
          recordTranscriptTimestamp(currentAssistantId, history);
          setChatHistories((prev) => ({ ...prev, [currentAssistantId]: history }));
          if (history.length < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
            setHasMoreMessages(false);
          }
          setPhase('ready');
        }
      } catch {
        if (cancelled) return;
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

    // Both ready — skip directly to ready
    if (!transcriptCutoffsRef.current[assistantId]) {
      recordTranscriptTimestamp(assistantId, chatHistories[assistantId] || []);
    }
    if ((chatHistories[assistantId]?.length ?? 0) < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
      setHasMoreMessages(false);
    }
    setContactId(cachedId);
    setCanChat(true);
    setPhase('ready');
  }, [phase, assistantId, chatHistories, userEmail, recordTranscriptTimestamp]);

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
    if (!oldestMessage || oldestMessage.messageId === undefined) {
      setHasMoreMessages(false);
      return;
    }

    setLoadMoreError(false);
    setIsLoadingMore(true);
    try {
      const result = await assistantActions.chat.getTranscripts(
        contactId,
        assistant.userId,
        assistantId,
        oldestMessage.messageId
      );
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
          const existingIds = new Set(current.map((m) => m.id));
          const uniqueNewMessages = newMessages.filter((m) => !existingIds.has(m.id));
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
      setChatHistories((prev) => {
        const current = prev[assistantId] || [];
        if (current.some((m) => m.id === messageWithDate.id)) {
          return prev;
        }
        const updated = [...current, messageWithDate].sort(
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
  // SSE connection (only when ready)
  // =========================================================================
  React.useEffect(() => {
    if (
      phase !== 'ready' ||
      !assistantId ||
      contactId === null ||
      assistantId !== activeAssistantIdRef.current
    )
      return;

    setConnectionStatus('connecting');
    const userContactId = contactId;

    const eventSource = new EventSource(
      `/api/assistant/${assistantId}/events?contactId=${contactId}`
    );

    const ack = (ackId: string) => {
      fetch(`/api/assistant/${assistantId}/events/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ackId, contactId: userContactId }),
      }).catch(() => {});
    };

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      sseReconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      stopReplying();
      try {
        const messagePayload: any = JSON.parse(event.data);
        const ackId: string | undefined = messagePayload.__ackId;

        const messageContactId = messagePayload.event?.contact_id ?? messagePayload.contact_id;
        if (messageContactId !== undefined && messageContactId !== userContactId) {
          if (ackId) ack(ackId);
          return;
        }

        if (messagePayload.publishTime) {
          const msgTime = new Date(messagePayload.publishTime).getTime();
          const cutoff = transcriptCutoffsRef.current[assistantId] || 0;
          if (msgTime < cutoff) {
            if (ackId) ack(ackId);
            return;
          }
        }

        if (messagePayload.thread === 'assistant_desktop_ready') {
          if (ackId) ack(ackId);
          const desktopChannel = new BroadcastChannel(`assistant-desktop-ready-${assistantId}`);
          desktopChannel.postMessage(messagePayload.event ?? {});
          desktopChannel.close();
          return;
        }

        if (messagePayload.thread === 'unify_message_outbound' || messagePayload.event) {
          const content =
            messagePayload.event?.content ??
            messagePayload.event?.body ??
            messagePayload.content ??
            messagePayload.rawContent ??
            '';
          const incomingId = messagePayload.id;
          const serverMsgId = incomingId || uuidv4();
          const publishTimeStr = messagePayload.publishTime;
          const timestamp = publishTimeStr ? new Date(publishTimeStr) : new Date();

          const rawAttachments = messagePayload.event?.attachments;
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

          const newAssistantMessage: ChatMessage = {
            id: serverMsgId,
            role: 'assistant',
            content: String(content),
            timestamp: timestamp,
            __ackId: ackId,
            ...(attachments && attachments.length > 0 ? { attachments } : {}),
          };

          setChatHistories((prev) => {
            const currentHistory = prev[assistantId] || [];
            if (serverMsgId && currentHistory.some((m) => m.id === serverMsgId)) {
              if (ackId) ack(ackId);
              return prev;
            }

            const lastMsg = currentHistory[currentHistory.length - 1];
            if (
              !incomingId &&
              lastMsg &&
              lastMsg.role === 'assistant' &&
              lastMsg.content === content
            ) {
              if (ackId) ack(ackId);
              return prev;
            }

            const updatedList = [...currentHistory, newAssistantMessage];
            updatedList.sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            return { ...prev, [assistantId]: updatedList };
          });

          const broadcastMsg = { ...newAssistantMessage };
          delete broadcastMsg.__ackId;
          const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
          const payload: BroadcastMessagePayload = {
            type: 'NEW_MESSAGE',
            message: broadcastMsg,
          };
          channel.postMessage(payload);
          channel.close();
        }
      } catch (error) {
        console.error('[Chat SSE] onmessage error:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();

      if (sseReconnectAttemptsRef.current < SSE_MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus('reconnecting');
        const delay = SSE_RECONNECT_BASE_DELAY * Math.pow(2, sseReconnectAttemptsRef.current);
        sseReconnectAttemptsRef.current += 1;

        if (sseReconnectTimeoutRef.current) {
          clearTimeout(sseReconnectTimeoutRef.current);
        }

        sseReconnectTimeoutRef.current = setTimeout(() => {
          setSseReconnectTrigger((prev) => prev + 1);
        }, delay);
      } else {
        setConnectionStatus('error');
        sseReconnectAttemptsRef.current = 0;
      }
    };

    return () => {
      stopReplying();
      eventSource.close();
      if (sseReconnectTimeoutRef.current) {
        clearTimeout(sseReconnectTimeoutRef.current);
        sseReconnectTimeoutRef.current = null;
      }
    };
  }, [phase, assistantId, contactId, setChatHistories, stopReplying, sseReconnectTrigger]);

  // =========================================================================
  // ACK displayed messages
  // =========================================================================
  React.useEffect(() => {
    if (!assistantId || contactId === null) return;
    messages.forEach((msg) => {
      if (msg.role === 'assistant' && msg.__ackId) {
        const ackId = msg.__ackId;
        fetch(`/api/assistant/${assistantId}/events/ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ackId, contactId }),
        }).catch(() => {});
        setChatHistories((prev) => {
          const current = prev[assistantId] || [];
          return {
            ...prev,
            [assistantId]: current.map((m) =>
              m.id === msg.id ? { ...m, __ackId: undefined } : m
            ),
          };
        });
      }
    });
  }, [messages, assistantId, contactId, setChatHistories]);

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

    const messageId = uuidv4();
    const newUserMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      attachments: attachments?.map((a) => ({
        id: a.id,
        filename: a.filename,
        gsUrl: a.gsUrl,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
      })),
    };

    setChatHistories((prev) => {
      const current = prev[currentAssistantId] || [];
      const updated = [...current, newUserMessage].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      return { ...prev, [currentAssistantId]: updated };
    });

    const messageToSend = inputValue.trim();
    setInputValue('');

    typingDelayTimerRef.current = setTimeout(() => {
      setIsAssistantReplying(true);
    }, 5000);

    const channel = new BroadcastChannel(`assistant-chat-sync-${currentAssistantId}`);
    const payload: BroadcastMessagePayload = {
      type: 'NEW_MESSAGE',
      message: newUserMessage,
    };
    channel.postMessage(payload);
    channel.close();

    const failedIds = new Set<string>();

    const updateChipStatus = (id: string, status: Attachment['uploadStatus']) => {
      if (status === 'error') failedIds.add(id);
      setPendingAttachments?.((prev) =>
        prev.map((a) => (a.id === id ? { ...a, uploadStatus: status } : a))
      );
    };

    const sendMessageWithAttachments = async () => {
      try {
        let uploadedAttachments: Attachment[] | undefined;

        if (attachments && attachments.length > 0) {
          const succeeded = await uploadAttachmentBatch(
            attachments,
            currentAssistant.agentId,
            {
              onStatusChange: updateChipStatus,
              onUploaded: (id, result) => {
                setPendingAttachments?.((prev) =>
                  prev.map((a) =>
                    a.id === id
                      ? { ...a, gsUrl: result.gsUrl, contentType: result.contentType, sizeBytes: result.sizeBytes }
                      : a
                  )
                );
              },
            }
          );

          if (failedIds.size > 0) {
            const failedCount = failedIds.size;
            toast.error(
              `${failedCount} attachment${failedCount > 1 ? 's' : ''} failed to upload`
            );
          }

          // Clear succeeded chips, keep failed ones with error status and remove buttons
          setPendingAttachments?.((prev) => prev.filter((a) => failedIds.has(a.id)));

          if (succeeded.length > 0) {
            uploadedAttachments = succeeded;

            setChatHistories((prev) => {
              const current = prev[currentAssistantId] || [];
              return {
                ...prev,
                [currentAssistantId]: current.map((msg) =>
                  msg.id === messageId ? { ...msg, attachments: uploadedAttachments } : msg
                ),
              };
            });
          }
        } else {
          // No attachments — clear pending list
          setPendingAttachments?.([]);
        }

        // Send message if there's text or at least one successful upload
        const hasMessageContent = messageToSend || (uploadedAttachments && uploadedAttachments.length > 0);
        if (hasMessageContent) {
          const response = await assistantActions.chat.message({
            assistantId: parseInt(currentAssistant.agentId),
            contactId: currentContactId,
            message: messageToSend,
            attachments: uploadedAttachments,
          });

          if (response.detail) {
            throw new Error(response.detail);
          }
        } else {
          // All uploads failed and no text — remove the optimistic message
          setChatHistories((prev) => ({
            ...prev,
            [currentAssistantId]: (prev[currentAssistantId] || []).filter(
              (msg) => msg.id !== messageId
            ),
          }));
          setInputValue(messageToSend);
          stopReplying();
        }
      } catch (error) {
        setChatHistories((prev) => ({
          ...prev,
          [currentAssistantId]: (prev[currentAssistantId] || []).filter(
            (msg) => msg.id !== messageId
          ),
        }));
        setInputValue(messageToSend);
        stopReplying();
        const errorMsg = error instanceof Error ? error.message : 'Failed to send message.';
        toast.error(errorMsg);

        // Restore all attachments on message-send failure
        if (attachments && attachments.length > 0) {
          setPendingAttachments?.(
            attachments.map((a) => ({ ...a, uploadStatus: undefined }))
          );
        }
      }
    };

    sendMessageWithAttachments();
  };

  // =========================================================================
  // Force SSE reconnection
  // =========================================================================
  const reconnectSSE = React.useCallback(() => {
    sseReconnectAttemptsRef.current = 0;
    setSseReconnectTrigger((prev) => prev + 1);
  }, []);

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
