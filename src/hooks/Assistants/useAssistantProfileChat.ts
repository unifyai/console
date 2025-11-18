import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, OutboundMessagePayload } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { toast } from 'sonner';

const INSUFFICIENT_CREDITS_MESSAGE = "Sorry, I couldn't get that properly; it looks like a technical issue on my end. I suggest we continue over phone or email. Otherwise maybe you could try refilling your credits balance? This should fix it.";
const BILLING_URL = "https://console.unify.ai/billing";

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
    const typingTimeoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);

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

    // Effect for 20s timeout on typing indicator
    React.useEffect(() => {
        if (isAssistantReplying) {
            typingTimeoutTimerRef.current = setTimeout(() => {
                setIsAssistantReplying(false);
            }, 20000); // Hide after 20 seconds
        }
        return () => {
            if (typingTimeoutTimerRef.current) {
                clearTimeout(typingTimeoutTimerRef.current);
            }
        };
    }, [isAssistantReplying]);


    React.useEffect(() => {
        if (!assistantId || !assistant) return;

        const hasBeenInitialized = chatHistories[assistantId] !== undefined;

        if (isFirstView && !firstViewProcessed.current) {
            firstViewProcessed.current = true;
            const initialHistory = preHireChat || [];
            if (initialHistory.length > 0) {
                setChatHistories(prev => ({ ...prev, [assistantId]: initialHistory }));
            } else {
                // Fallback: If for some reason preHireChat is empty on first view, fetch history.
                setIsInitialLoading(true);
                const context = `${assistant.first_name}${assistant.surname}`;
                assistantActions.chat.getTranscripts(context)
                    .then(historyResult => {
                        if ('detail' in historyResult) {
                            console.error(historyResult.detail);
                            setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                        } else {
                            const history = (historyResult as ChatMessage[]).reverse();
                            setChatHistories(prev => ({ ...prev, [assistantId]: history }));
                        }
                    })
                    .catch(err => {
                        console.error("Error fetching transcripts:", err);
                        setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                    })
                    .finally(() => setIsInitialLoading(false));
            }
            onFirstViewCompleted?.();

        } else if (!isFirstView && !hasBeenInitialized) {
            // Case C: Existing assistant, fetch history
            setIsInitialLoading(true);
            const context = `${assistant.first_name}${assistant.surname}`;
            assistantActions.chat.getTranscripts(context)
                .then(historyResult => {
                    if ('detail' in historyResult) {
                        console.error(historyResult.detail);
                        setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                    } else {
                        const history = (historyResult as ChatMessage[]).reverse();
                        setChatHistories(prev => ({ ...prev, [assistantId]: history }));
                    }
                })
                .catch(err => {
                    console.error("Error fetching transcripts:", err);
                    setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                })
                .finally(() => {
                    setIsInitialLoading(false);
                });
        } else if (!isFirstView) {
            // Reset the ref if it's no longer the first view (e.g., user re-opens profile later)
            firstViewProcessed.current = false;
        }
    }, [
        assistantId,
        assistant,
        isFirstView,
        preHireChat,
        onFirstViewCompleted,
        chatHistories,
        setChatHistories,
        assistantActions.chat
    ]);

    // Effect for listening to incoming messages via SSE
    React.useEffect(() => {
        if (!assistantId) return;

        setConnectionStatus('connecting');
        const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

        eventSource.onopen = () => {
            console.log(`[SSE Client] Connection opened for assistant ${assistantId}`);
            setConnectionStatus('connected');
        };

        eventSource.onmessage = (event) => {
            try {
                const messagePayload : OutboundMessagePayload = JSON.parse(event.data);
                const eventPayload = messagePayload.event;
                
                // Only process events that are actual outbound messages with content
                if (messagePayload.thread === 'unify_message_outbound') {
                    const newAssistantMessage: ChatMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: eventPayload.content,
                        timestamp: new Date(),
                    };

                    setChatHistories(prev => {
                        const currentHistory = prev[assistantId] || [];
                        return {
                            ...prev,
                            [assistantId]: [...currentHistory, newAssistantMessage]
                        };
                    });
                } else {
                    console.warn("[SSE Client] Received message with unexpected data format:", messagePayload);
                }
            } catch (error) {
                console.error("[SSE Client] Error parsing incoming message:", error);
            }
            clearTimers();
            setIsAssistantReplying(false);
        };

        const handleServerError = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data);

                // Fatal errors that cannot recover (e.g., unauthorized)
                if (payload.status === 401 || payload.status === 403) {
                    console.error("[SSE Client] Fatal auth error:", payload);
                    setConnectionStatus('error');
                    toast.error("Failed to authenticate while connecting to the assistant. Please refresh.");
                    eventSource.close();   // only close for fatal errors
                    return;
                }

                // For everything else: mark reconnecting but DO NOT close
                console.warn("[SSE Client] Server returned recoverable error:", payload);
                setConnectionStatus('reconnecting');

            } catch {
                // If server sent plain text, still treat it as recoverable
                console.warn("[SSE Client] Non-JSON server error:", event.data);
                setConnectionStatus('reconnecting');
            }
        };


        eventSource.addEventListener('error', handleServerError);

        let retryCount = 0;
        eventSource.onerror = (error) => {
            retryCount++;
            if (eventSource.readyState === EventSource.CONNECTING) {
                console.warn("[SSE Client] Connection lost, attempting to reconnect...", error);
                setConnectionStatus('reconnecting');
            }
            if (retryCount > 5) {
                console.error("[SSE Client] A non-retriable EventSource error occurred:", error);
                setConnectionStatus('error');
            }
        };

        return () => {
            clearTimers();
            console.log(`[SSE Client] Closing connection for assistant ${assistantId}`);
            eventSource.removeEventListener('error', handleServerError);
            eventSource.close();
        };
    }, [assistantId, setChatHistories, clearTimers]);

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

            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to send message:", errorMessage);
            toast.error("Failed to send message. Please try again.");
            
            setChatHistories(prev => ({
                ...prev,
                [assistantId]: (prev[assistantId] || []).filter(msg => msg.id !== newUserMessage.id)
            }));
            setInputValue(messageToSend);
            clearTimers();
            setIsAssistantReplying(false);

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