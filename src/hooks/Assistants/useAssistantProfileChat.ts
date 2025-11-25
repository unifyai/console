import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';

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

    const firstViewProcessed = React.useRef(false);
    const typingDelayTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const typingTimeoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const fetchInitiatedRef = React.useRef<Set<string>>(new Set());
    const historyLoadedRef = React.useRef<Set<string>>(new Set());

    // Sync historyLoadedRef with incoming props in case history was loaded in a previous session/mount
    React.useEffect(() => {
        if (assistantId && chatHistories[assistantId] !== undefined) {
            historyLoadedRef.current.add(assistantId);
        }
    }, [assistantId, chatHistories]);

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
        let isMounted = true;
        if (fetchInitiatedRef.current.has(assistantId) && !hasBeenInitialized) {
            return;
        }
        if (isFirstView && !firstViewProcessed.current) {
            firstViewProcessed.current = true;
            const initialHistory = preHireChat || [];
            setChatHistories(prev => ({ ...prev, [assistantId]: initialHistory }));
            historyLoadedRef.current.add(assistantId);
            if (isMounted) onFirstViewCompleted?.();
        } else if (!hasBeenInitialized) {
            fetchInitiatedRef.current.add(assistantId);
            setIsInitialLoading(true);
            const context = `${assistant.first_name}${assistant.surname}`;            
            assistantActions.chat.getTranscripts(context)
                .then(historyResult => {
                    if (!isMounted) return;
                    historyLoadedRef.current.add(assistantId);
                    if ('detail' in historyResult) {
                        setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                    } else {
                        const history = (historyResult as ChatMessage[]).reverse();
                        setChatHistories(prev => ({ ...prev, [assistantId]: history }));
                    }
                })
                .catch(() => {
                    if (!isMounted) return;
                    historyLoadedRef.current.add(assistantId);
                    setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                })
                .finally(() => {
                    if (isMounted) setIsInitialLoading(false);
                });
        } else if (!isFirstView) {
            firstViewProcessed.current = false;
        }
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assistantId, isFirstView, preHireChat, onFirstViewCompleted]);

    // PubSub SSE Connection (client-side ACK model)
    React.useEffect(() => {
        if (!assistantId) return;

        setConnectionStatus('connecting');
        const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

        eventSource.onopen = () => {
            setConnectionStatus('connected');
        };

        eventSource.onmessage = (event) => {
            stopReplying();
            try {
                const messagePayload: any = JSON.parse(event.data);
                const ackId = messagePayload.__ackId;

                // If history hasn't loaded yet, ACK the message but drop it.
                // This prevents duplicating messages that will be loaded via transcripts.
                if (!historyLoadedRef.current.has(assistantId)) {
                    if (ackId) {
                        fetch(`/api/assistant/${assistantId}/events/ack`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ackId }),
                        }).catch(err => console.warn('Early ACK failed', err));
                    }
                    return; 
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
    }, [assistantId, setChatHistories, stopReplying]);

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
    };
}