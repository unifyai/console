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

    // --- 1. Typing Indicator Timeout (Visual only) ---
    // Hide typing indicator after 20 seconds if no response is received.
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

    // --- 2. Initial Load ---
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assistantId, isFirstView, preHireChat, onFirstViewCompleted]); 


    // --- 3. PubSub SSE Connection ---
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
                const messagePayload : OutboundMessagePayload = JSON.parse(event.data);
                
                if (messagePayload.thread === 'unify_message_outbound') {
                    const content = messagePayload.event.content;
                    const serverMsgId = messagePayload.id || uuidv4();                    
                    const publishTimeStr = messagePayload.publishTime;
                    const timestamp = publishTimeStr ? new Date(publishTimeStr) : new Date();

                    setChatHistories(prev => {
                        const currentHistory = prev[assistantId] || [];
                        
                        if (serverMsgId && currentHistory.some(m => m.id === serverMsgId)) {
                            return prev;
                        }
                        const lastMsg = currentHistory[currentHistory.length - 1];
                        if (!serverMsgId && lastMsg && lastMsg.role === 'assistant' && lastMsg.content === content) {
                            return prev;
                        }

                        const newAssistantMessage: ChatMessage = {
                            id: serverMsgId,
                            role: 'assistant',
                            content: content,
                            timestamp: timestamp,
                        };

                        const updatedList = [...currentHistory, newAssistantMessage];
                        updatedList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                        return { ...prev, [assistantId]: updatedList };
                    });
                }
            } catch (error) {/* noop */}
        };

        eventSource.onerror = (error) => {
            if (eventSource.readyState === EventSource.CLOSED) {
                setConnectionStatus('reconnecting');
            } else if (eventSource.readyState === EventSource.CONNECTING) {
                setConnectionStatus('reconnecting');
            } else {
                setConnectionStatus('error');
            }
        };

        return () => {
            stopReplying();
            eventSource.close();
        };
    }, [assistantId, setChatHistories, stopReplying]);
    
    // --- 4. Message Sending ---
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