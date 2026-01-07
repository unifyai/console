import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, BroadcastMessagePayload } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';

export function useAssistantProfileChat(
    assistant: Assistant | null,
    assistantActions: Pick<AssistantActions, 'chat'>,
    chatHistories: Record<string, ChatMessage[]>,
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>,
    userEmail: string | null | undefined,
    isFirstView?: boolean,
    preHireChat?: ChatMessage[],
    onFirstViewCompleted?: () => void,
) {
    const assistantId = assistant?.agentId || null;

    const messages = React.useMemo(() => {
        const raw = assistantId ? chatHistories[assistantId] || [] : [];
        return [...raw].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [chatHistories, assistantId]);

    const [inputValue, setInputValue] = React.useState('');
    const [isAssistantReplying, setIsAssistantReplying] = React.useState(false);
    const [isInitialLoading, setIsInitialLoading] = React.useState(false);
    const [initialLoadError, setInitialLoadError] = React.useState(false);
    const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
    const [hasMoreMessages, setHasMoreMessages] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [loadMoreError, setLoadMoreError] = React.useState(false);
    const [hasFetchedHistory, setHasFetchedHistory] = React.useState(false);
    const [historyLoadedForAssistantId, setHistoryLoadedForAssistantId] = React.useState<string | null>(null);    
    const firstViewProcessed = React.useRef(false);
    const typingDelayTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const typingTimeoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const fetchInitiatedRef = React.useRef<Set<string>>(new Set());
    const transcriptCutoffsRef = React.useRef<Record<string, number>>({});

    // Contact ID caching and chat permission state
    const [contactIdCache, setContactIdCache] = React.useState<Map<string, number>>(new Map());
    const [canChat, setCanChat] = React.useState<boolean>(true);
    
    // Owner context cache: maps assistant_id -> owner context string
    const ownerContextCacheRef = React.useRef<Map<string, string>>(new Map());
    
    // Track assistants that have already had contact sync triggered (to avoid re-syncing on chat close/open)
    const contactSyncTriggeredRef = React.useRef<Set<string>>(new Set());

    // Get the current user's contact_id for the active assistant
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
            const maxTime = Math.max(...msgs.map(m => new Date(m.timestamp).getTime()));
            if (!transcriptCutoffsRef.current[id] || maxTime > transcriptCutoffsRef.current[id]) {
                transcriptCutoffsRef.current[id] = maxTime;
            }
        } else if (!transcriptCutoffsRef.current[id]) {
            transcriptCutoffsRef.current[id] = 0;
        }
    }, []);

    /**
     * Resolves the owner context string from an assistant.
     * Uses user_first_name/user_last_name if available.
     * Falls back to fetching user details via getAssistantOwnerById if names are missing.
     * Caches results to avoid repeated lookups.
     */
    const resolveOwnerContext = React.useCallback(async (currentAssistant: Assistant): Promise<string | null> => {
        // Check cache first
        const cached = ownerContextCacheRef.current.get(currentAssistant.agentId);
        if (cached) return cached;

        // Try direct names from assistant object
        if (currentAssistant.userFirstName && currentAssistant.userLastName) {
            const context = `${currentAssistant.userFirstName}${currentAssistant.userLastName}`;
            ownerContextCacheRef.current.set(currentAssistant.agentId, context);
            return context;
        }

        // Fallback: fetch user details via server action
        if (currentAssistant.userId) {
            try {
                const userDetails = await assistantActions.chat.getAssistantOwnerById(currentAssistant.userId);
                if (userDetails && userDetails.firstName) {
                    const context = `${userDetails.firstName}${userDetails.lastName || ''}`;
                    ownerContextCacheRef.current.set(currentAssistant.agentId, context);
                    return context;
                }
            } catch (error) {/* no-op */}
        }

        return null;
    }, [assistantActions.chat]);

    /**
     * Initializes chat for an assistant:
     * 1. Resolves owner context (uses user_first_name/user_last_name from assistant, or falls back to getAssistantOwnerById)
     * 2. Looks up user's contact_id
     * 3. Fetches transcripts if contact_id found
     * 4. Sets canChat=false if contact_id not found
     */
    const fetchInitialHistory = React.useCallback(async (currentAssistantId: string, currentAssistant: Assistant) => {
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

        const assistantContext = `${currentAssistant.firstName}${currentAssistant.surname}`;

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

                const lookedUpContactId = await assistantActions.chat.getContactId(ownerContext, assistantContext, userEmail);
                
                if (lookedUpContactId === null) {
                    // User not in contacts - trigger contact sync (only once per assistant) and cannot chat
                    if (!contactSyncTriggeredRef.current.has(currentAssistantId)) {
                        contactSyncTriggeredRef.current.add(currentAssistantId);
                        assistantActions.chat.triggerContactSync(currentAssistantId).catch(err => {/* no-op */});
                    }
                    
                    setCanChat(false);
                    setIsInitialLoading(false);
                    setChatHistories(prev => ({ ...prev, [currentAssistantId]: [] }));
                    setHistoryLoadedForAssistantId(currentAssistantId);
                    return;
                }

                contactId = lookedUpContactId;
                // Cache the contact_id
                setContactIdCache(prev => new Map(prev).set(currentAssistantId, contactId));
            }

            // Fetch transcripts with the contact_id
            const historyResult = await assistantActions.chat.getTranscripts(ownerContext, assistantContext, contactId);
            
            if ('detail' in historyResult) {
                setInitialLoadError(true);
            } else {
                const history = (historyResult as ChatMessage[]).reverse();
                recordTranscriptTimestamp(currentAssistantId, history);
                setChatHistories(prev => ({ ...prev, [currentAssistantId]: history }));
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
    }, [assistantActions.chat, recordTranscriptTimestamp, setChatHistories, userEmail, contactIdCache, resolveOwnerContext]);

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

            setChatHistories(prev => ({ ...prev, [assistantId]: initialHistory }));
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
                (async () => {
                    const ownerContext = await resolveOwnerContext(assistant);
                    if (!ownerContext) {
                        setCanChat(false);
                        return;
                    }
                    const assistantContext = `${assistant.firstName}${assistant.surname}`;
                    const contactId = await assistantActions.chat.getContactId(ownerContext, assistantContext, userEmail);
                    if (contactId === null) {
                        // User not in contacts - trigger contact sync (only once per assistant)
                        if (!contactSyncTriggeredRef.current.has(assistantId)) {
                            contactSyncTriggeredRef.current.add(assistantId);
                            assistantActions.chat.triggerContactSync(assistantId).catch(err => {/* no-op */});
                        }
                        setCanChat(false);
                    } else {
                        setContactIdCache(prev => new Map(prev).set(assistantId, contactId));
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
    }, [assistantId, isFirstView, preHireChat, onFirstViewCompleted, userEmail, contactIdCache, resolveOwnerContext, assistantActions.chat]);

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
        if (!oldestMessage || oldestMessage.message_id === undefined) {
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
        const assistantContext = `${assistant.firstName}${assistant.surname}`; 
        try {
            const result = await assistantActions.chat.getTranscripts(ownerContext, assistantContext, contactId, oldestMessage.message_id);
            setHasFetchedHistory(true);
            if ('detail' in result) {
                setLoadMoreError(true);
            } else {
                const newMessages = (result as ChatMessage[]).reverse();
                if (newMessages.length < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) {
                    setHasMoreMessages(false);
                }
                setChatHistories(prev => {
                    const current = prev[assistantId] || [];
                    const existingIds = new Set(current.map(m => m.id));
                    const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
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
                timestamp: new Date(incomingMsg.timestamp)
            };
            if (messageWithDate.__ackId) {
                delete messageWithDate.__ackId;
            }
            setChatHistories(prev => {
                const current = prev[assistantId] || [];
                if (current.some(m => m.id === messageWithDate.id)) {
                    return prev;
                }
                const updated = [...current, messageWithDate].sort((a, b) => 
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
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

        const userContactId = contactIdCache.get(assistantId);
        // If we don't have a contact_id, we shouldn't be connecting to SSE
        if (userContactId === undefined) return;

        setConnectionStatus('connecting');
        const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

        const ack = (ackId: string) => {
             fetch(`/api/assistant/${assistantId}/events/ack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ackId }),
            }).catch(err => {/* noop */});
        };

        eventSource.onopen = () => {
            setConnectionStatus('connected');
        };

        eventSource.onmessage = (event) => {
            stopReplying();
            try {
                const messagePayload: any = JSON.parse(event.data);
                const ackId = messagePayload.__ackId;

                // Filter by contact_id: only display and ACK messages for this user
                const messageContactId = messagePayload.contactId;
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
                    const content = messagePayload.event?.content ?? messagePayload.event?.body ?? messagePayload.content ?? messagePayload.raw_content ?? '';
                    const incomingId = messagePayload.id;
                    const serverMsgId = incomingId || uuidv4();
                    const publishTimeStr = messagePayload.publishTime;
                    const timestamp = publishTimeStr ? new Date(publishTimeStr) : new Date();

                    const newAssistantMessage: ChatMessage = {
                        id: serverMsgId,
                        role: 'assistant',
                        content: String(content),
                        timestamp: timestamp,
                        __ackId: ackId
                    };

                    setChatHistories(prev => {
                        const currentHistory = prev[assistantId] || [];
                        if (serverMsgId && currentHistory.some(m => m.id === serverMsgId)) {
                            if (ackId) ack(ackId);
                            return prev;
                        }

                        const lastMsg = currentHistory[currentHistory.length - 1];
                        if (!incomingId && lastMsg && lastMsg.role === 'assistant' && lastMsg.content === content) {
                            return prev;
                        }

                        const updatedList = [...currentHistory, newAssistantMessage];
                        updatedList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        return { ...prev, [assistantId]: updatedList };
                    });

                    const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
                    const broadcastMsg = { ...newAssistantMessage };
                    delete broadcastMsg.__ackId; 
                    const payload: BroadcastMessagePayload = {
                        type: 'NEW_MESSAGE',
                        message: broadcastMsg
                    };
                    channel.postMessage(payload);
                    channel.close();
                }
            } catch (error) {/* noop */}
        };

        eventSource.onerror = (error) => {
            setConnectionStatus(prev => (eventSource.readyState === EventSource.CLOSED ? 'reconnecting' : 'reconnecting'));
        };

        return () => {
            stopReplying();
            eventSource.close();
        };
    }, [assistantId, setChatHistories, stopReplying, historyLoadedForAssistantId, canChat, contactIdCache]);

    // Acknowledge displayed messages and cleanup __ackId from acknowledged messages
    // This only runs in the tab that successfully received the SSE message with the __ackId
    React.useEffect(() => {
        if (!assistantId) return;
        messages.forEach(msg => {
            if (msg.role === 'assistant' && msg.__ackId) {
                const ackId = msg.__ackId;
                fetch(`/api/assistant/${assistantId}/events/ack`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ackId }),
                })
                .catch(err => {/* noop */});
                setChatHistories(prev => {
                    const current = prev[assistantId] || [];
                    return {
                        ...prev,
                        [assistantId]: current.map(m =>
                            m.id === msg.id ? { ...m, __ackId: undefined } : m
                        ),
                    };
                });
            }
        });
    }, [messages, assistantId, setChatHistories]);

    // Send message with contact_id
    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isInitialLoading || initialLoadError || !assistant || !assistantId || !canChat) return;

        const contactId = contactIdCache.get(assistantId);
        if (contactId === undefined) {
            toast.error("Cannot send message: not connected to assistant");
            return;
        }

        clearTimers();

        const newUserMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        // 1. Update Local State (Optimistic)
        setChatHistories(prev => {
            const current = prev[assistantId] || [];
            const updated = [...current, newUserMessage].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return { ...prev, [assistantId]: updated };
        });

        const messageToSend = inputValue.trim();
        setInputValue('');

        typingDelayTimerRef.current = setTimeout(() => {
            setIsAssistantReplying(true);
        }, 5000);

        // 2. Broadcast to other tabs
        const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
        const payload: BroadcastMessagePayload = {
            type: 'NEW_MESSAGE',
            message: newUserMessage
        };
        channel.postMessage(payload);
        channel.close();

        // 3. Send to Backend with contact_id
        assistantActions.chat.message({
            assistantId: parseInt(assistant.agentId),
            contactId: contactId,
            message: messageToSend
        }).then(response => {
            if (response.detail) {
                throw new Error(response.detail);
            }
        }).catch(error => {
            setChatHistories(prev => ({
                ...prev,
                [assistantId]: (prev[assistantId] || []).filter(msg => msg.id !== newUserMessage.id)
            }));
            setInputValue(messageToSend);
            stopReplying();
            toast.error("Failed to send message.");
        });
    };

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
        // Chat permission state
        canChat,
        currentContactId,
    };
}
