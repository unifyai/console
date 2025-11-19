import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, OutboundMessagePayload } from '@/types/assistants/chat';
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
    const messages = assistantId ? chatHistories[assistantId] || [] : [];
    
    const [inputValue, setInputValue] = React.useState('');
    const [isAssistantReplying, setIsAssistantReplying] = React.useState(false);
    const [isInitialLoading, setIsInitialLoading] = React.useState(false);
    const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');

    const firstViewProcessed = React.useRef(false);
    const typingDelayTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const fallbackTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const typingTimeoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const hasConnectedOnceRef = React.useRef(false);

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
        if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
        }
    }, []);

    const stopReplying = React.useCallback(() => {
        clearTimers();
        setIsAssistantReplying(false);
    }, [clearTimers]);

    const reconcileTranscripts = React.useCallback(async () => {
        if (!assistantId || !assistant) return;

        const context = `${assistant.first_name}${assistant.surname}`;
        const historyResult = await assistantActions.chat.getTranscripts(context);

        if ('detail' in historyResult) return;

        const fetchedHistory = (historyResult as ChatMessage[]).reverse();
        
        setChatHistories(prev => {
            const currentLocalHistory = prev[assistantId] || [];
            
            // (a) Base is the fetched history from the server (Source of Truth)
            const mergedHistory = [...fetchedHistory];

            if (mergedHistory.length > 0) {
                const lastServerMsg = mergedHistory[mergedHistory.length - 1];

                // (b) Find where the server history ends within the local history.
                // We search backwards from the local history to find the most recent occurrence
                // that matches the last server message.
                let matchIndex = -1;

                for (let i = currentLocalHistory.length - 1; i >= 0; i--) {
                    const localMsg = currentLocalHistory[i];

                    // Primary match: Content and Role
                    if (localMsg.content === lastServerMsg.content && localMsg.role === lastServerMsg.role) {
                        
                        // (c) Secondary match: Predecessor check to differentiate duplicates.
                        // Ensure this specific "Hi" matches the context of the server's "Hi" 
                        // by checking if the message before it is also the same.
                        const prevServerMsg = mergedHistory.length > 1 ? mergedHistory[mergedHistory.length - 2] : null;
                        const prevLocalMsg = i > 0 ? currentLocalHistory[i - 1] : null;

                        const isPredecessorMatch = 
                            (!prevServerMsg && !prevLocalMsg) || // Start of conversation
                            (prevServerMsg && prevLocalMsg && prevServerMsg.content === prevLocalMsg.content && prevServerMsg.role === prevLocalMsg.role);

                        if (isPredecessorMatch) {
                            matchIndex = i;
                            break;
                        }
                    }
                }

                if (matchIndex !== -1) {
                    // If we found the sync point, append only the messages that occurred LOCALLY after that point.
                    const localTail = currentLocalHistory.slice(matchIndex + 1);
                    mergedHistory.push(...localTail);
                } else {
                    // Fallback: If context matching failed (e.g., drastic history changes), 
                    // append local messages strictly newer than the server's last timestamp.
                    const serverEndTime = new Date(lastServerMsg.timestamp).getTime();
                    const localTail = currentLocalHistory.filter(m => new Date(m.timestamp).getTime() > serverEndTime);
                    
                    // Simple deduplication for the fallback tail to prevent immediate stutter
                    const cleanTail = localTail.filter(m => 
                        !(m.content === lastServerMsg.content && m.role === lastServerMsg.role)
                    );
                    mergedHistory.push(...cleanTail);
                }
            } else if (currentLocalHistory.length > 0) {
                // If server returned nothing but we have local messages, assume they are all pending sync.
                return { ...prev, [assistantId]: currentLocalHistory };
            }

            // Ensure typing indicator logic is consistent
            if (mergedHistory.length > 0) {
                const lastMsg = mergedHistory[mergedHistory.length - 1];
                if (lastMsg.role === 'assistant') {
                    stopReplying();
                }
            }

            return { ...prev, [assistantId]: mergedHistory };
        });

    }, [assistantId, assistant, assistantActions.chat, setChatHistories, stopReplying]);

    // --- 1. Watch for Visibility Changes (Tab Switching) ---
    React.useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (navigator.onLine) {
                   reconcileTranscripts();
                }
            }
        };

        const handleOnline = () => {
            setConnectionStatus('reconnecting');
            reconcileTranscripts();
        };

        const handleOffline = () => {
            setConnectionStatus('reconnecting');
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [reconcileTranscripts]);


    // --- 2. Typing Indicator Timers (Fallback) ---
    React.useEffect(() => {
        if (isAssistantReplying) {
            // Fallback: After 18 seconds of typing, refetch transcripts just in case SSE failed.
            fallbackTimerRef.current = setTimeout(() => {
                reconcileTranscripts();
            }, 18000);

            // Timeout: Hide typing indicator after 20 seconds if no response is received.
            typingTimeoutTimerRef.current = setTimeout(() => {
                setIsAssistantReplying(false);
            }, 20000);
        }

        return () => {
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
            if (typingTimeoutTimerRef.current) clearTimeout(typingTimeoutTimerRef.current);
        };
    }, [isAssistantReplying, reconcileTranscripts]);


    // --- 3. Initial Load ---
    React.useEffect(() => {
        if (!assistantId || !assistant) return;

        const hasBeenInitialized = chatHistories[assistantId] !== undefined;

        if (isFirstView && !firstViewProcessed.current) {
            firstViewProcessed.current = true;
            const initialHistory = preHireChat || [];
            setChatHistories(prev => ({ ...prev, [assistantId]: initialHistory }));
            onFirstViewCompleted?.();
        } else if (!hasBeenInitialized) {
            setIsInitialLoading(true);
            const context = `${assistant.first_name}${assistant.surname}`;
            assistantActions.chat.getTranscripts(context)
                .then(historyResult => {
                    if ('detail' in historyResult) {
                        setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                    } else {
                        const history = (historyResult as ChatMessage[]).reverse();
                        setChatHistories(prev => ({ ...prev, [assistantId]: history }));
                    }
                })
                .catch(() => {
                    setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                })
                .finally(() => setIsInitialLoading(false));
        } else if (!isFirstView) {
            firstViewProcessed.current = false;
        }
    }, [
        assistantId,
        isFirstView,
        preHireChat,
        onFirstViewCompleted,
        chatHistories,
        setChatHistories,
        assistantActions.chat
    ]);

    // --- 4. SSE Connection Logic ---
    React.useEffect(() => {
        if (!assistantId) return;

        hasConnectedOnceRef.current = false;
        setConnectionStatus('connecting');
        let retryCount = 0; 
        const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

        eventSource.onopen = () => {
            setConnectionStatus('connected');
            retryCount = 0;
            if (hasConnectedOnceRef.current) {
                reconcileTranscripts();
            }
            hasConnectedOnceRef.current = true;
        };

        eventSource.onmessage = (event) => {
            stopReplying(); 
            try {
                const messagePayload : OutboundMessagePayload = JSON.parse(event.data);
                if (messagePayload.thread === 'unify_message_outbound') {
                    const newAssistantMessage: ChatMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: messagePayload.event.content,
                        timestamp: new Date(),
                    };
                    setChatHistories(prev => {
                        const currentHistory = prev[assistantId] || [];
                        return { ...prev, [assistantId]: [...currentHistory, newAssistantMessage] };
                    });
                } else {/* noop */}
            } catch (error) {/* noop */}
        };

        const handleServerError = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.status === 401 || payload.status === 403) {
                    setConnectionStatus('error');
                    toast.error("Failed to authenticate while connecting to the assistant. Please refresh.");
                    eventSource.close();
                    return;
                }
            } catch {/* // Ignore parsing errors on error events */}
            setConnectionStatus('reconnecting');
        };

        eventSource.addEventListener('error', handleServerError as EventListener);

        eventSource.onerror = (error) => {
            retryCount++;
            if (eventSource.readyState === EventSource.CLOSED) {
                setConnectionStatus('reconnecting');
            } else if (eventSource.readyState === EventSource.CONNECTING) {
                setConnectionStatus('reconnecting');
            }
            if (retryCount > 5) {
                setConnectionStatus('error');
                eventSource.close();
                toast.error("Lost connection to assistant. Refresh to reconnect.");
            }
        };

        return () => {
            stopReplying();
            eventSource.removeEventListener('error', handleServerError as EventListener);
            eventSource.close();
        };
    }, [assistantId, setChatHistories, stopReplying, reconcileTranscripts]);

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

        setChatHistories(prev => ({
            ...prev,
            [assistantId]: [...(prev[assistantId] || []), newUserMessage]
        }));

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