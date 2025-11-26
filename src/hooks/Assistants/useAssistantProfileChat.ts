import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';

export function useAssistantProfileChat(
    assistant: Assistant | null,
    assistantActions: Pick<AssistantActions, 'chat'>,
    chatHistories: Record<string, ChatMessage[]>,
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>,
    isFirstView?: boolean,
    preHireChat?: ChatMessage[],
    onFirstViewCompleted?: () => void,
) {
    const assistantId = assistant?.agent_id || null;

    const messages = React.useMemo(() => {
        const raw = assistantId ? chatHistories[assistantId] || [] : [];
        return [...raw].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [chatHistories, assistantId]);

    const [inputValue, setInputValue] = React.useState('');
    const [isAssistantReplying, setIsAssistantReplying] = React.useState(false);
    const [isInitialLoading, setIsInitialLoading] = React.useState(false);
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

    // Reset UI state when assistant changes
    React.useEffect(() => {
        setHasMoreMessages(true);
        setHasFetchedHistory(false);
        setLoadMoreError(false);
        setHistoryLoadedForAssistantId(null);
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

    // Initial load
    React.useEffect(() => {
        if (!assistantId || !assistant) return;
        const hasBeenInitialized = chatHistories[assistantId] !== undefined;
        if (fetchInitiatedRef.current.has(assistantId) && !hasBeenInitialized) {
            return;
        }
        const recordTranscriptTimestamp = (id: string, msgs: ChatMessage[]) => {
            if (msgs.length > 0) {
                const maxTime = Math.max(...msgs.map(m => new Date(m.timestamp).getTime()));
                if (!transcriptCutoffsRef.current[id] || maxTime > transcriptCutoffsRef.current[id]) {
                    transcriptCutoffsRef.current[id] = maxTime;
                }
            } else if (!transcriptCutoffsRef.current[id]) {
                transcriptCutoffsRef.current[id] = 0;
            }
        };
        if (isFirstView && !firstViewProcessed.current) {
            firstViewProcessed.current = true;
            const initialHistory = preHireChat || [];
            recordTranscriptTimestamp(assistantId, initialHistory);
            setChatHistories(prev => ({ ...prev, [assistantId]: initialHistory }));
            onFirstViewCompleted?.();
            setHistoryLoadedForAssistantId(assistantId);
        } else if (!hasBeenInitialized) {
            fetchInitiatedRef.current.add(assistantId);
            setIsInitialLoading(true);
            const context = `${assistant.first_name}${assistant.surname}`;            
            assistantActions.chat.getTranscripts(context)
                .then(historyResult => {
                    if ('detail' in historyResult) {
                        setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                        setHasMoreMessages(false);
                        recordTranscriptTimestamp(assistantId, []); 
                    } else {
                        const history = (historyResult as ChatMessage[]).reverse();
                        recordTranscriptTimestamp(assistantId, history);
                        setChatHistories(prev => ({ ...prev, [assistantId]: history }));
                        if (history.length < ASSISTANT_CHAT_LOADED_MESSAGES_COUNT) setHasMoreMessages(false);
                    }
                })
                .catch(() => {
                    setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                    setHasMoreMessages(false);
                    recordTranscriptTimestamp(assistantId, []);
                })
                .finally(() => {
                    setIsInitialLoading(false);
                    setHistoryLoadedForAssistantId(assistantId); // Enable SSE connection now
                });
        } else {
            if (!transcriptCutoffsRef.current[assistantId] && chatHistories[assistantId]?.length > 0) {
                 transcriptCutoffsRef.current[assistantId] = 0;
            }
            if (historyLoadedForAssistantId !== assistantId) {
                setHistoryLoadedForAssistantId(assistantId);
            }
            if (!isFirstView) {
                firstViewProcessed.current = false;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assistantId, isFirstView, preHireChat, onFirstViewCompleted]);

    // Pagination: Load more messages
    const loadMoreMessages = async () => {
        if (isLoadingMore || !hasMoreMessages || !assistant || !assistantId) return;
        const oldestMessage = messages[0];
        if (!oldestMessage || oldestMessage.message_id === undefined) {
            setHasMoreMessages(false);
            return;
        }
        
        setLoadMoreError(false);
        setIsLoadingMore(true);
        const context = `${assistant.first_name}${assistant.surname}`; 
        try {
            const result = await assistantActions.chat.getTranscripts(context, oldestMessage.message_id);
            setHasFetchedHistory(true);
            if ('detail' in result) {
                console.error("Failed to load more messages:", result.detail);
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
            console.error("Error loading more messages", error);
            setLoadMoreError(true);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // PubSub SSE Connection
    React.useEffect(() => {
        if (!assistantId || historyLoadedForAssistantId !== assistantId) return;

        setConnectionStatus('connecting');
        const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

        const ack = (ackId: string) => {
             fetch(`/api/assistant/${assistantId}/events/ack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ackId }),
            }).catch(err => console.warn('ACK failed', err));
        };

        eventSource.onopen = () => {
            setConnectionStatus('connected');
        };

        eventSource.onmessage = (event) => {
            stopReplying();
            try {
                const messagePayload: any = JSON.parse(event.data);
                const ackId = messagePayload.__ackId;

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

                        const newAssistantMessage: ChatMessage = {
                            id: serverMsgId,
                            role: 'assistant',
                            content: String(content),
                            timestamp: timestamp,
                            __ackId: ackId
                        };

                        const updatedList = [...currentHistory, newAssistantMessage];
                        updatedList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                        return { ...prev, [assistantId]: updatedList };
                    });
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
    }, [assistantId, setChatHistories, stopReplying, historyLoadedForAssistantId]);

    // Acknowledge displayed messages and cleanup __ackId from acknowledged messages
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
                .catch(err => {
                    console.warn('Failed to ack message', ackId, err);
                });
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

    // Send message
    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isInitialLoading || !assistant || !assistantId) return;

        clearTimers();

        const newUserMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

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

        assistantActions.chat.message({
            assistant_id: parseInt(assistant.agent_id),
            contact_id: 1,
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
        isAssistantReplying,
        handleInputChange,
        sendMessage,
        connectionStatus,
        loadMoreMessages,
        hasMoreMessages,
        isLoadingMore,
        loadMoreError,
        hasFetchedHistory
    };
}