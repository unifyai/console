import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '@/types/assistants/chat';
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

    const firstViewProcessed = React.useRef(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    React.useEffect(() => {
        if (messages.length === 0) return;
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'assistant' && lastMessage.content.trim() !== '') {
            setIsAssistantReplying(false);
        }
    }, [messages]);


    React.useEffect(() => {
        if (!assistantId || !assistant) return;

        const hasBeenInitialized = chatHistories[assistantId] !== undefined;

        if (isFirstView && !firstViewProcessed.current) {
            firstViewProcessed.current = true;
            const generateAndSetGreeting = async () => {
                setIsInitialLoading(true);
                const initialHistory = preHireChat || [];
                const greetingMessageId = uuidv4();
                const placeholderMessage: ChatMessage = { id: greetingMessageId, role: 'assistant', content: '', timestamp: new Date() };

                setChatHistories(prev => ({ ...prev, [assistantId]: [...initialHistory, placeholderMessage] }));

                try {
                    const response = await fetch('/api/assistant/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'post-hire-greeting',
                            assistantId: assistant.agent_id,
                            assistantName: `${assistant.first_name} ${assistant.surname}`,
                            assistantAge: assistant.age,
                            assistantBio: assistant.about,
                            assistantNationality: assistant.nationality,
                            preHireChat: preHireChat?.map(({ role, content }) => ({ role, content }))
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || "Failed to generate greeting.");
                    }

                    const { content } = await response.json();
                    if (!content) throw new Error("LLM returned an empty greeting.");
                    
                    setChatHistories(prev => {
                        const updatedHistory = (prev[assistantId] || []).map(msg =>
                            msg.id === greetingMessageId ? { ...msg, content } : msg
                        );
                        return { ...prev, [assistantId]: updatedHistory };
                    });

                } catch (error) {
                    console.error("Failed to generate post-hire greeting:", error);
                    const fallbackContent = `Hey, great to see you again! Feel free to message here, text or call me on my phone whenever.`;
                    
                    setChatHistories(prev => {
                        const updatedHistory = (prev[assistantId] || []).map(msg =>
                            msg.id === greetingMessageId ? { ...msg, content: fallbackContent } : msg
                        );
                        return { ...prev, [assistantId]: updatedHistory };
                    });
                } finally {
                    setIsInitialLoading(false);
                    onFirstViewCompleted?.();
                }
            };
            generateAndSetGreeting();
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

        const eventSource = new EventSource(`/api/assistant/${assistantId}/events`);

        eventSource.onopen = () => {
            console.log(`[SSE Client] Connection opened for assistant ${assistantId}`);
        };

        eventSource.onmessage = (event) => {
            try {
                const messageData = JSON.parse(event.data);
                const messageContent = messageData.event?.content;
                
                if (typeof messageContent === 'string') {
                    const newAssistantMessage: ChatMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: messageContent,
                        timestamp: new Date(),
                    };

                    setChatHistories(prev => {
                        const currentHistory = prev[assistantId] || [];
                        if (currentHistory.some(m => m.content === newAssistantMessage.content && m.role === 'assistant' && (new Date().getTime() - m.timestamp.getTime() < 2000))) {
                             return prev;
                        }
                        return {
                            ...prev,
                            [assistantId]: [...currentHistory, newAssistantMessage]
                        };
                    });
                } else {
                    console.warn("[SSE Client] Received message with unexpected data format:", messageData);
                }
            } catch (error) {
                console.error("[SSE Client] Error parsing incoming message:", error);
            }
        };

        eventSource.onerror = (error) => {
            console.error("[SSE Client] EventSource error:", error);
            eventSource.close();
        };

        return () => {
            console.log(`[SSE Client] Closing connection for assistant ${assistantId}`);
            eventSource.close();
        };
    }, [assistantId, setChatHistories]);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isInitialLoading || !assistant || !assistantId) return;

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
        setIsAssistantReplying(true);

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
    };
}