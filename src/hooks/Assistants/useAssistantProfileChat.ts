import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, BroadcastMessagePayload, ChatAttachment } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { formatUserContext, formatAssistantContext } from '@/utils/assistants/context-utils';

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

  const [inputValue, setInputValue] = React.useState('');
  const [isAssistantReplying, setIsAssistantReplying] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(false);
  const [initialLoadError, setInitialLoadError] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<
    'connecting' | 'connected' | 'reconnecting' | 'error'
  >('connecting');
  const [hasMoreMessages, setHasMoreMessages] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [hasFetchedHistory, setHasFetchedHistory] = React.useState(false);
  const [historyLoadedForAssistantId, setHistoryLoadedForAssistantId] = React.useState<
    string | null
  >(null);
  const firstViewProcessed = React.useRef(false);
  const typingDelayTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const fetchInitiatedRef = React.useRef<Set<string>>(new Set());
  const transcriptCutoffsRef = React.useRef<Record<string, number>>({});

  // SSE reconnection state
  const [sseReconnectTrigger, setSseReconnectTrigger] = React.useState(0);
  const sseReconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const sseReconnectAttemptsRef = React.useRef(0);
  const SSE_MAX_RECONNECT_ATTEMPTS = 5;
  const SSE_RECONNECT_BASE_DELAY = 1000; // 1 second, will use exponential backoff

  // Contact ID caching and chat permission state
  const [contactIdCache, setContactIdCache] = React.useState<Map<string, number>>(new Map());
  const [canChat, setCanChat] = React.useState<boolean>(true);
  const [isRetryingContactId, setIsRetryingContactId] = React.useState<boolean>(false);

  // Owner context cache: maps assistant_id -> owner context string
  const ownerContextCacheRef = React.useRef<Map<string, string>>(new Map());

  // Track assistants that have already had contact sync triggered (to avoid re-syncing on chat close/open)
  const contactSyncTriggeredRef = React.useRef<Set<string>>(new Set());

  // Auto-retry for contact_id resolution
  const contactIdRetryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const contactIdRetryAttemptsRef = React.useRef<Map<string, number>>(new Map());
  const CONTACT_ID_RETRY_DELAY = 5000; // 5 seconds between retries
  const CONTACT_ID_MAX_RETRIES = 6; // Max 6 retries (30 seconds total)

  // Get the current user's contact_id for the active assistant
  // This value is stable and only changes when the contact ID for THIS assistant changes
  const currentContactId = React.useMemo(() => {
    if (!assistantId) return null;
    return contactIdCache.get(assistantId) ?? null;
  }, [assistantId, contactIdCache]);

  // Reset UI state when assistant changes
  React.useEffect(() => {
    setHasMoreMessages(true);
    setHasFetchedHistory(false);
    setLoadMoreError(false);
    setInitialLoadError(false);
    setHistoryLoadedForAssistantId(null);
    // Reset canChat - will be determined during initialization
    setCanChat(true);
    setIsRetryingContactId(false);

    // Clear any pending contact_id retry timeout when assistant changes
    if (contactIdRetryTimeoutRef.current) {
      clearTimeout(contactIdRetryTimeoutRef.current);
      contactIdRetryTimeoutRef.current = null;
    }
  }, [assistantId]);

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

  // Typing timeout
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

  // Helper to calculate and store the latest timestamp
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

  /**
   * Resolves the owner context string from an assistant.
   * Uses userFirstName/userLastName if available.
   * Falls back to fetching user details via getAssistantOwnerById if names are missing.
   * Caches results to avoid repeated lookups.
   */
  const resolveOwnerContext = React.useCallback(
    async (currentAssistant: Assistant): Promise<string | null> => {
      // Check cache first
      const cached = ownerContextCacheRef.current.get(currentAssistant.agentId);
      if (cached) return cached;

      // Try direct names from assistant object
      if (currentAssistant.userFirstName && currentAssistant.userLastName) {
        const context = formatUserContext(
          currentAssistant.userFirstName,
          currentAssistant.userLastName
        );
        ownerContextCacheRef.current.set(currentAssistant.agentId, context);
        return context;
      }

      // Fallback: fetch user details via server action
      if (currentAssistant.userId) {
        try {
          const userDetails = await assistantActions.chat.getAssistantOwnerById(
            currentAssistant.userId
          );
          if (userDetails && userDetails.firstName) {
            const context = formatUserContext(userDetails.firstName, userDetails.lastName || '');
            ownerContextCacheRef.current.set(currentAssistant.agentId, context);
            return context;
          }
        } catch (error) {
          /* no-op */
        }
      }

      return null;
    },
    [assistantActions.chat]
  );

  /**
   * Retries getting the contact_id for an assistant.
   * Called automatically after contact sync is triggered.
   */
  const retryContactIdLookup = React.useCallback(
    async (currentAssistantId: string, currentAssistant: Assistant) => {
      // Get current retry count
      const currentRetries = contactIdRetryAttemptsRef.current.get(currentAssistantId) || 0;

      if (currentRetries >= CONTACT_ID_MAX_RETRIES) {
        // Max retries reached, stop retrying
        setIsRetryingContactId(false);
        contactIdRetryAttemptsRef.current.delete(currentAssistantId);
        return;
      }

      // Resolve owner context
      const ownerContext = await resolveOwnerContext(currentAssistant);
      if (!ownerContext) {
        // Schedule next retry
        contactIdRetryAttemptsRef.current.set(currentAssistantId, currentRetries + 1);
        contactIdRetryTimeoutRef.current = setTimeout(() => {
          retryContactIdLookup(currentAssistantId, currentAssistant);
        }, CONTACT_ID_RETRY_DELAY);
        return;
      }

      const assistantContext = formatAssistantContext(
        currentAssistant.firstName,
        currentAssistant.surname
      );

      try {
        const contactId = await assistantActions.chat.getContactId(
          ownerContext,
          assistantContext,
          userEmail || '',
          currentAssistant.userId,
          currentAssistantId
        );

        if (contactId !== null) {
          // Success! Cache the contact_id and enable chat
          setContactIdCache((prev) => new Map(prev).set(currentAssistantId, contactId));
          setCanChat(true);
          setIsRetryingContactId(false);
          contactIdRetryAttemptsRef.current.delete(currentAssistantId);

          // Fetch transcripts now that we have a contact_id
          const historyResult = await assistantActions.chat.getTranscripts(
            ownerContext,
            assistantContext,
            contactId,
            currentAssistant.userId,
            currentAssistantId
          );

          if (!('detail' in historyResult)) {
            const history = (historyResult as ChatMessage[]).reverse();
            recordTranscriptTimestamp(currentAssistantId, history);
            setChatHistories((prev) => ({ ...prev, [currentAssistantId]: history }));
            if (history.length < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
              setHasMoreMessages(false);
            }
            setHistoryLoadedForAssistantId(currentAssistantId);
          }
        } else {
          // Still no contact_id, schedule next retry
          contactIdRetryAttemptsRef.current.set(currentAssistantId, currentRetries + 1);
          contactIdRetryTimeoutRef.current = setTimeout(() => {
            retryContactIdLookup(currentAssistantId, currentAssistant);
          }, CONTACT_ID_RETRY_DELAY);
        }
      } catch {
        // Error occurred, schedule next retry
        contactIdRetryAttemptsRef.current.set(currentAssistantId, currentRetries + 1);
        contactIdRetryTimeoutRef.current = setTimeout(() => {
          retryContactIdLookup(currentAssistantId, currentAssistant);
        }, CONTACT_ID_RETRY_DELAY);
      }
    },
    [
      assistantActions.chat,
      resolveOwnerContext,
      userEmail,
      recordTranscriptTimestamp,
      setChatHistories,
    ]
  );

  /**
   * Initializes chat for an assistant:
   * 1. Resolves owner context (uses userFirstName/userLastName from assistant, or falls back to getAssistantOwnerById)
   * 2. Looks up user's contact_id
   * 3. Fetches transcripts if contact_id found
   * 4. Sets canChat=false if contact_id not found
   */
  const fetchInitialHistory = React.useCallback(
    async (currentAssistantId: string, currentAssistant: Assistant) => {
      setIsInitialLoading(true);
      setInitialLoadError(false);

      // Check if we already have a cached contact_id
      const cachedContactId = contactIdCache.get(currentAssistantId);

      // Resolve owner context (async with fallback)
      const ownerContext = await resolveOwnerContext(currentAssistant);
      if (!ownerContext) {
        setCanChat(false);
        setIsInitialLoading(false);
        setInitialLoadError(true);
        return;
      }

      const assistantContext = formatAssistantContext(
        currentAssistant.firstName,
        currentAssistant.surname
      );

      try {
        let contactId: number;

        // Lookup contact_id if not cached
        if (cachedContactId !== undefined) {
          contactId = cachedContactId;
        } else {
          if (!userEmail) {
            setCanChat(false);
            setIsInitialLoading(false);
            setInitialLoadError(true);
            return;
          }

          const lookedUpContactId = await assistantActions.chat.getContactId(
            ownerContext,
            assistantContext,
            userEmail,
            currentAssistant.userId,
            currentAssistantId
          );

          if (lookedUpContactId === null) {
            // User not in contacts - trigger contact sync (only once per assistant) and start retry
            if (!contactSyncTriggeredRef.current.has(currentAssistantId)) {
              contactSyncTriggeredRef.current.add(currentAssistantId);
              assistantActions.chat.triggerContactSync(currentAssistantId).catch(() => {
                /* no-op */
              });
            }

            setCanChat(false);
            setIsInitialLoading(false);
            setChatHistories((prev) => ({ ...prev, [currentAssistantId]: [] }));
            setHistoryLoadedForAssistantId(currentAssistantId);

            // Start auto-retry for contact_id
            setIsRetryingContactId(true);
            contactIdRetryAttemptsRef.current.set(currentAssistantId, 0);
            contactIdRetryTimeoutRef.current = setTimeout(() => {
              retryContactIdLookup(currentAssistantId, currentAssistant);
            }, CONTACT_ID_RETRY_DELAY);

            return;
          }

          contactId = lookedUpContactId;
          // Cache the contact_id
          setContactIdCache((prev) => new Map(prev).set(currentAssistantId, contactId));
        }

        // Fetch transcripts with the contact_id
        const historyResult = await assistantActions.chat.getTranscripts(
          ownerContext,
          assistantContext,
          contactId,
          currentAssistant.userId,
          currentAssistantId
        );

        if ('detail' in historyResult) {
          setInitialLoadError(true);
        } else {
          const history = (historyResult as ChatMessage[]).reverse();
          recordTranscriptTimestamp(currentAssistantId, history);
          setChatHistories((prev) => ({ ...prev, [currentAssistantId]: history }));
          if (history.length < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
            setHasMoreMessages(false);
          }
          setCanChat(true);
          setHistoryLoadedForAssistantId(currentAssistantId); // Enable SSE
        }
      } catch (error) {
        setInitialLoadError(true);
      } finally {
        setIsInitialLoading(false);
      }
    },
    [
      assistantActions.chat,
      recordTranscriptTimestamp,
      setChatHistories,
      userEmail,
      contactIdCache,
      resolveOwnerContext,
      retryContactIdLookup,
    ]
  );

  // Initial loading
  React.useEffect(() => {
    if (!assistantId || !assistant) return;
    const hasBeenInitialized = chatHistories[assistantId] !== undefined;
    if (fetchInitiatedRef.current.has(assistantId) && !hasBeenInitialized && !initialLoadError) {
      return;
    }
    if (isFirstView && !firstViewProcessed.current) {
      firstViewProcessed.current = true;
      const initialHistory = preHireChat || [];
      recordTranscriptTimestamp(assistantId, initialHistory);

      fetchInitiatedRef.current.add(assistantId);

      setChatHistories((prev) => ({ ...prev, [assistantId]: initialHistory }));
      onFirstViewCompleted?.();
      setHistoryLoadedForAssistantId(assistantId);
    } else if (!hasBeenInitialized) {
      fetchInitiatedRef.current.add(assistantId);
      fetchInitialHistory(assistantId, assistant);
    } else {
      // History already initialized - ensure contactId is also resolved
      if (!transcriptCutoffsRef.current[assistantId] && chatHistories[assistantId]?.length > 0) {
        transcriptCutoffsRef.current[assistantId] = 0;
      }

      // If contactId isn't cached, we need to resolve it before enabling SSE
      const cachedContactId = contactIdCache.get(assistantId);
      if (cachedContactId === undefined && userEmail) {
        // Resolve contactId asynchronously
        const currentAssistant = assistant;
        const currentAssistantId = assistantId;
        (async () => {
          const ownerContext = await resolveOwnerContext(currentAssistant);
          if (!ownerContext) {
            setCanChat(false);
            return;
          }
          const assistantContext = formatAssistantContext(
            currentAssistant.firstName,
            currentAssistant.surname
          );
          const contactId = await assistantActions.chat.getContactId(
            ownerContext,
            assistantContext,
            userEmail,
            currentAssistant.userId,
            currentAssistantId
          );
          if (contactId === null) {
            // User not in contacts - trigger contact sync (only once per assistant)
            if (!contactSyncTriggeredRef.current.has(currentAssistantId)) {
              contactSyncTriggeredRef.current.add(currentAssistantId);
              assistantActions.chat.triggerContactSync(currentAssistantId).catch(() => {
                /* no-op */
              });
            }
            setCanChat(false);

            // Start auto-retry for contact_id
            setIsRetryingContactId(true);
            contactIdRetryAttemptsRef.current.set(currentAssistantId, 0);
            contactIdRetryTimeoutRef.current = setTimeout(() => {
              retryContactIdLookup(currentAssistantId, currentAssistant);
            }, CONTACT_ID_RETRY_DELAY);
          } else {
            setContactIdCache((prev) => new Map(prev).set(currentAssistantId, contactId));
            setCanChat(true);
          }
        })();
      }

      if (historyLoadedForAssistantId !== assistantId) {
        setHistoryLoadedForAssistantId(assistantId);
      }
      if (!isFirstView) {
        firstViewProcessed.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assistantId,
    isFirstView,
    preHireChat,
    onFirstViewCompleted,
    userEmail,
    contactIdCache,
    resolveOwnerContext,
    assistantActions.chat,
  ]);

  const retryInitialLoad = () => {
    if (assistantId && assistant) {
      fetchInitialHistory(assistantId, assistant);
    }
  };

  // Pagination: Load more messages
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !assistant || !assistantId || !canChat) return;

    const contactId = contactIdCache.get(assistantId);
    if (contactId === undefined) {
      return;
    }

    const oldestMessage = messages[0];
    if (!oldestMessage || oldestMessage.messageId === undefined) {
      setHasMoreMessages(false);
      return;
    }

    // Use cached owner context (should be available since initial load succeeded)
    const ownerContext = await resolveOwnerContext(assistant);
    if (!ownerContext) {
      setLoadMoreError(true);
      return;
    }

    setLoadMoreError(false);
    setIsLoadingMore(true);
    const assistantContext = formatAssistantContext(assistant.firstName, assistant.surname);
    try {
      const result = await assistantActions.chat.getTranscripts(
        ownerContext,
        assistantContext,
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

  // Broadcast Channel Sync
  // Handles both User sent messages and Server received messages relayed from other tabs.
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
      if (messageWithDate.__ackId) {
        delete messageWithDate.__ackId;
      }
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

  // PubSub SSE Connection with contact_id filtering
  React.useEffect(() => {
    if (!assistantId || historyLoadedForAssistantId !== assistantId || !canChat) return;

    // Use currentContactId (a primitive) as a dependency to avoid unnecessary reconnections
    // when the contactIdCache Map reference changes but the actual contact ID hasn't
    const userContactId = currentContactId;
    // If we don't have a contact_id, we shouldn't be connecting to SSE
    if (userContactId === undefined || userContactId === null) return;

    setConnectionStatus('connecting');
    const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

    const ack = (ackId: string) => {
      fetch(`/api/assistant/${assistantId}/events/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ackId }),
      }).catch((err) => {
        /* noop */
      });
    };

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      // Reset reconnect attempts on successful connection
      sseReconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      stopReplying();
      try {
        const messagePayload: any = JSON.parse(event.data);
        const ackId = messagePayload.__ackId;

        // Filter by contact_id: only display and ACK messages for this user
        const messageContactId = messagePayload.event?.contactId ?? messagePayload.contactId;
        if (messageContactId !== undefined && messageContactId !== userContactId) {
          // Message is not for this user - don't ACK, let it be redelivered
          return;
        }

        // Check if message is older than the API Transcript
        // If message is strictly older than what we loaded from the API, it's a zombie.
        // Acknowledge it but don't display it in the chat.
        if (messagePayload.publishTime) {
          const msgTime = new Date(messagePayload.publishTime).getTime();
          const cutoff = transcriptCutoffsRef.current[assistantId] || 0;
          if (msgTime < cutoff) {
            if (ackId) ack(ackId);
            return;
          }
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

          const newAssistantMessage: ChatMessage = {
            id: serverMsgId,
            role: 'assistant',
            content: String(content),
            timestamp: timestamp,
            __ackId: ackId,
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
              return prev;
            }

            const updatedList = [...currentHistory, newAssistantMessage];
            updatedList.sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            return { ...prev, [assistantId]: updatedList };
          });

          const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
          const broadcastMsg = { ...newAssistantMessage };
          delete broadcastMsg.__ackId;
          const payload: BroadcastMessagePayload = {
            type: 'NEW_MESSAGE',
            message: broadcastMsg,
          };
          channel.postMessage(payload);
          channel.close();
        }
      } catch (error) {
        /* noop */
      }
    };

    eventSource.onerror = () => {
      // Close the failed connection
      eventSource.close();

      // Check if we should attempt reconnection
      if (sseReconnectAttemptsRef.current < SSE_MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus('reconnecting');

        // Calculate delay with exponential backoff
        const delay = SSE_RECONNECT_BASE_DELAY * Math.pow(2, sseReconnectAttemptsRef.current);
        sseReconnectAttemptsRef.current += 1;

        // Clear any existing reconnect timeout
        if (sseReconnectTimeoutRef.current) {
          clearTimeout(sseReconnectTimeoutRef.current);
        }

        // Schedule reconnection
        sseReconnectTimeoutRef.current = setTimeout(() => {
          setSseReconnectTrigger((prev) => prev + 1);
        }, delay);
      } else {
        // Max attempts reached
        setConnectionStatus('error');
        sseReconnectAttemptsRef.current = 0;
      }
    };

    return () => {
      stopReplying();
      eventSource.close();
      // Clear reconnect timeout on cleanup
      if (sseReconnectTimeoutRef.current) {
        clearTimeout(sseReconnectTimeoutRef.current);
        sseReconnectTimeoutRef.current = null;
      }
    };
  }, [
    assistantId,
    setChatHistories,
    stopReplying,
    historyLoadedForAssistantId,
    canChat,
    currentContactId, // Use primitive contact ID instead of contactIdCache Map to prevent unnecessary reconnections
    sseReconnectTrigger, // Re-run effect when reconnect is triggered
  ]);

  // Acknowledge displayed messages and cleanup __ackId from acknowledged messages
  // This only runs in the tab that successfully received the SSE message with the __ackId
  React.useEffect(() => {
    if (!assistantId) return;
    messages.forEach((msg) => {
      if (msg.role === 'assistant' && msg.__ackId) {
        const ackId = msg.__ackId;
        fetch(`/api/assistant/${assistantId}/events/ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ackId }),
        }).catch((err) => {
          /* noop */
        });
        setChatHistories((prev) => {
          const current = prev[assistantId] || [];
          return {
            ...prev,
            [assistantId]: current.map((m) => (m.id === msg.id ? { ...m, __ackId: undefined } : m)),
          };
        });
      }
    });
  }, [messages, assistantId, setChatHistories]);

  // Send message with contact_id
  const sendMessage = (
    e: React.FormEvent,
    attachments?: ChatAttachment[],
    onError?: (attachments: ChatAttachment[]) => void
  ) => {
    e.preventDefault();

    // Allow sending if there's text OR attachments
    const hasContent = inputValue.trim() || (attachments && attachments.length > 0);
    if (
      !hasContent ||
      isInitialLoading ||
      initialLoadError ||
      !assistant ||
      !assistantId ||
      !canChat
    )
      return;

    const contactId = contactIdCache.get(assistantId);
    if (contactId === undefined) {
      toast.error('Cannot send message: not connected to assistant');
      return;
    }

    // Capture values at call time to ensure consistent closure in async handlers
    const currentAssistantId = assistantId;
    const currentAssistant = assistant;

    clearTimers();

    const messageId = uuidv4();
    const newUserMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      attachments: attachments?.map((a) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        // file: omitted - don't store File objects in history
      })),
    };

    // 1. Update Local State (Optimistic)
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

    // 2. Broadcast to other tabs
    const channel = new BroadcastChannel(`assistant-chat-sync-${currentAssistantId}`);
    const payload: BroadcastMessagePayload = {
      type: 'NEW_MESSAGE',
      message: newUserMessage,
    };
    channel.postMessage(payload);
    channel.close();

    // 3. Send to Backend with contact_id
    assistantActions.chat
      .message({
        assistantId: parseInt(currentAssistant.agentId),
        contactId: contactId,
        message: messageToSend,
      })
      .then((response) => {
        if (response.detail) {
          throw new Error(response.detail);
        }
      })
      .catch((error) => {
        // Use captured messageId and currentAssistantId to ensure correct rollback
        // even when multiple messages are sent rapidly
        setChatHistories((prev) => ({
          ...prev,
          [currentAssistantId]: (prev[currentAssistantId] || []).filter(
            (msg) => msg.id !== messageId
          ),
        }));
        setInputValue(messageToSend);
        stopReplying();
        toast.error('Failed to send message.');

        // Restore attachments if callback provided
        if (onError && attachments && attachments.length > 0) {
          onError(attachments);
        }
      });
  };

  // Force SSE reconnection (useful when chat becomes re-enabled after being blocked)
  const reconnectSSE = React.useCallback(() => {
    // Reset reconnect attempts to allow fresh reconnection
    sseReconnectAttemptsRef.current = 0;
    // Trigger reconnection by incrementing the trigger
    setSseReconnectTrigger((prev) => prev + 1);
  }, []);

  // Cleanup retry timeout on unmount
  React.useEffect(() => {
    return () => {
      if (contactIdRetryTimeoutRef.current) {
        clearTimeout(contactIdRetryTimeoutRef.current);
        contactIdRetryTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    messages,
    inputValue,
    isLoading: isInitialLoading,
    initialLoadError,
    retryInitialLoad,
    isAssistantReplying,
    handleInputChange,
    sendMessage,
    connectionStatus,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore,
    loadMoreError,
    hasFetchedHistory,
    canChat,
    isRetryingContactId,
    currentContactId,
    reconnectSSE,
  };
}
