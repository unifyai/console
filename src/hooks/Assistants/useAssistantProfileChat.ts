import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, BroadcastMessagePayload, Attachment } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { uploadAttachment as uploadAttachmentClient } from '@/components/Chat/attachmentUtils';
import { snakeToCamelObject } from '@/utils/casing';

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

const CONTACT_ID_RETRY_DELAY = 5000;
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

  // Connection banner: suppress brief connecting/reconnecting flashes (e.g. the
  // 60-second SSE cycle). Only surface the banner after a grace period, so
  // transient reconnections are invisible to the user.
  const CONNECTION_BANNER_GRACE_MS = 3000;
  const [showConnectionBanner, setShowConnectionBanner] = React.useState(false);
  const connectionBannerTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (connectionStatus === 'connected') {
      if (connectionBannerTimerRef.current) {
        clearTimeout(connectionBannerTimerRef.current);
        connectionBannerTimerRef.current = null;
      }
      setShowConnectionBanner(false);
    } else if (connectionStatus === 'error') {
      if (connectionBannerTimerRef.current) {
        clearTimeout(connectionBannerTimerRef.current);
        connectionBannerTimerRef.current = null;
      }
      setShowConnectionBanner(true);
    } else {
      // connecting or reconnecting — start grace period
      if (!connectionBannerTimerRef.current) {
        connectionBannerTimerRef.current = setTimeout(() => {
          connectionBannerTimerRef.current = null;
          setShowConnectionBanner(true);
        }, CONNECTION_BANNER_GRACE_MS);
      }
    }
    return () => {
      if (connectionBannerTimerRef.current) {
        clearTimeout(connectionBannerTimerRef.current);
        connectionBannerTimerRef.current = null;
      }
    };
  }, [connectionStatus]);

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
    if (phase !== 'uninitialized' || !assistantId || !assistant) return;

    activeAssistantIdRef.current = assistantId;

    const cachedId = contactIdCacheRef.current.get(assistantId);

    if (isFirstView && !initDoneRef.current) {
      initDoneRef.current = true;
      const initialHistory = preHireChat || [];
      recordTranscriptTimestamp(assistantId, initialHistory);
      setChatHistories((prev) => ({ ...prev, [assistantId]: initialHistory }));
      onFirstViewCompleted?.();
      if (cachedId !== undefined) {
        setContactId(cachedId);
        setPhase('ready');
      } else {
        setPhase('pending_contact');
      }
    } else if (chatHistories[assistantId] !== undefined) {
      if (!transcriptCutoffsRef.current[assistantId] && chatHistories[assistantId]?.length > 0) {
        transcriptCutoffsRef.current[assistantId] = 0;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, assistantId, assistant, recordTranscriptTimestamp, setChatHistories]);

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

    let cancelled = false;
    let retryTimer: NodeJS.Timeout;
    const currentAssistantId = assistantId;
    const currentAssistant = assistant;
    const skipTranscripts = phase === 'pending_contact';

    const resolve = async (attempt: number) => {
      try {
        const id = await assistantActions.chat.getContactId(
          userEmail,
          currentAssistant.userId,
          currentAssistantId
        );
        if (cancelled) return;

        if (id !== null) {
          contactIdCacheRef.current.set(currentAssistantId, id);
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
          retryTimer = setTimeout(() => {
            if (!cancelled) resolve(attempt + 1);
          }, CONTACT_ID_RETRY_DELAY);
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
          retryTimer = setTimeout(() => {
            if (!cancelled) resolve(attempt + 1);
          }, CONTACT_ID_RETRY_DELAY);
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
        const result = await assistantActions.chat.getTranscripts(
          contactId,
          assistant.userId,
          currentAssistantId
        );
        if (cancelled) return;

        if ('detail' in result) {
          setInitialLoadError(true);
          setPhase('error');
        } else {
          const history = (result as ChatMessage[]).reverse();
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

    const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      sseReconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      stopReplying();
      try {
        const messagePayload: any = JSON.parse(event.data);

        const messageContactId = messagePayload.event?.contact_id ?? messagePayload.contact_id;
        if (messageContactId !== undefined && messageContactId !== userContactId) {
          return;
        }

        if (messagePayload.publishTime) {
          const msgTime = new Date(messagePayload.publishTime).getTime();
          const cutoff = transcriptCutoffsRef.current[assistantId] || 0;
          if (msgTime < cutoff) {
            return;
          }
        }

        if (messagePayload.thread === 'assistant_desktop_ready') {
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
            ...(attachments && attachments.length > 0 ? { attachments } : {}),
          };

          setChatHistories((prev) => {
            const currentHistory = prev[assistantId] || [];
            if (serverMsgId && currentHistory.some((m) => m.id === serverMsgId)) {
              return prev;
            }

            const lastMsg = currentHistory[currentHistory.length - 1];
            if (
              !incomingId &&
              lastMsg &&
              lastMsg.role === 'assistant' &&
              lastMsg.content === content
            ) {
              return prev;
            }

            const updatedList = [...currentHistory, newAssistantMessage];
            updatedList.sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            return { ...prev, [assistantId]: updatedList };
          });

          const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
          const payload: BroadcastMessagePayload = {
            type: 'NEW_MESSAGE',
            message: newAssistantMessage,
          };
          channel.postMessage(payload);
          channel.close();
        }
      } catch (error) {
        /* noop */
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
  // Send message
  // =========================================================================
  const sendMessage = (
    e: React.FormEvent,
    attachments?: Attachment[],
    onError?: (attachments: Attachment[]) => void
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

    const sendMessageWithAttachments = async () => {
      try {
        let uploadedAttachments: Attachment[] | undefined;

        if (attachments && attachments.length > 0) {
          const uploadPromises = attachments
            .filter((a) => a.file)
            .map(async (a) => {
              const uploadResult = await uploadAttachmentClient(a.file!, currentAssistant.agentId);
              return {
                id: uploadResult.id,
                filename: uploadResult.filename,
                gsUrl: uploadResult.gsUrl,
                contentType: uploadResult.contentType,
                sizeBytes: uploadResult.sizeBytes,
              } satisfies Attachment;
            });

          uploadedAttachments = await Promise.all(uploadPromises);

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

        const response = await assistantActions.chat.message({
          assistantId: parseInt(currentAssistant.agentId),
          contactId: currentContactId,
          message: messageToSend,
          attachments: uploadedAttachments,
        });

        if (response.detail) {
          throw new Error(response.detail);
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

        if (onError && attachments && attachments.length > 0) {
          onError(attachments);
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
    showConnectionBanner,
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
