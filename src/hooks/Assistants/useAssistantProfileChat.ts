import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '@/types/assistants/chat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';

const INSUFFICIENT_CREDITS_MESSAGE = "Sorry, I couldn't get that properly; it looks like a technical issue on my end. I suggest we continue over phone or email. Otherwise maybe you could try refilling your credits balance? This should fix it.";
const BILLING_URL = "https://console.unify.ai/billing";

export function useAssistantProfileChat(
    assistant: Assistant | null,
    assistantActions: AssistantActions,
    chatHistories: Record<string, ChatMessage[]>,
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>,
    isFirstView?: boolean,
    preHireChat?: ChatMessage[],
    onFirstViewCompleted?: () => void,
) {
    const assistantId = assistant?.agent_id || null;
    const messages = assistantId ? chatHistories[assistantId] || [] : [];
    
    const [inputValue, setInputValue] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    const firstViewProcessed = React.useRef(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };
    
    const logMessagesToHistory = async (newMessages: Omit<ChatMessage, 'id'>[]) => {
        if (!assistant) return;
        // Create context from first and last name, removing all whitespace
        const context = `${assistant.first_name}${assistant.surname}`;
        let startMessageId = 0;
        let shouldLogMessageId = true;

        try {
            // Fetch existing transcripts to find the last message_id
            const historyResult = await assistantActions.chat.getTranscripts(context);

            if ('detail' in historyResult) {
                // This is an error response. Don't log message_id.
                console.error("Failed to fetch chat history for logging:", historyResult.detail);
                shouldLogMessageId = false;
            } else {
                const historicalMessages = historyResult as ChatMessage[];
                if (historicalMessages.length > 0) {
                    // Sort by timestamp just in case they are out of order
                    historicalMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    const lastMessage = historicalMessages[historicalMessages.length - 1];
                    if (typeof lastMessage.message_id === 'number') {
                        startMessageId = lastMessage.message_id + 1;
                    }
                }
            }
        } catch (error) {
            // Catch any other exceptions during fetch
            console.error("Exception while fetching chat history for logging:", error);
            shouldLogMessageId = false;
        }

        // Prepare messages with or without message_id
        const messagesToLog = newMessages.map((msg, index) => {
            if (shouldLogMessageId) {
                return { ...msg, message_id: startMessageId + index };
            }
            // Exclude message_id if there was an error
            const { message_id, ...rest } = msg as ChatMessage;
            return rest;
        });

        try {
            await assistantActions.chat.updateTranscripts(context, messagesToLog);
        } catch (error) {
            console.error("Failed to log chat history:", error);
            // Non-critical, so we don't show a user-facing toast
        }
    };

    React.useEffect(() => {
        if (!assistantId || !assistant) return;

        const hasBeenInitialized = (chatHistories[assistantId]?.length || 0) > 0;

        if (isFirstView && !firstViewProcessed.current) {
            firstViewProcessed.current = true;
            const generateAndSetGreeting = async () => {
                setIsLoading(true);
                const initialHistory = preHireChat || [];
                setChatHistories(prev => ({ ...prev, [assistantId]: initialHistory }));

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
                            assistantRegion: assistant.region,
                            preHireChat: preHireChat?.map(({ role, content }) => ({ role, content }))
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || "Failed to generate greeting.");
                    }

                    const { content } = await response.json();
                    if (!content) throw new Error("LLM returned an empty greeting.");
                    
                    const greetingMessage: ChatMessage = { id: uuidv4(), role: 'assistant', content, timestamp: new Date() };
                    const messageToLog: Omit<ChatMessage, 'id'> = { role: greetingMessage.role, content: greetingMessage.content, timestamp: greetingMessage.timestamp };
                    
                    // logMessagesToHistory([messageToLog]);
                    setChatHistories(prev => ({ ...prev, [assistantId]: [...initialHistory, greetingMessage] }));

                } catch (error) {
                    console.error("Failed to generate post-hire greeting:", error);
                    const fallbackMessage: ChatMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: `Hey, great to see you again! Feel free to message here, text or call me on my phone whenever.`,
                        timestamp: new Date(),
                    };
                    const fallbackToLog: Omit<ChatMessage, 'id'> = { role: fallbackMessage.role, content: fallbackMessage.content, timestamp: fallbackMessage.timestamp };

                    // Only log the fallback if there wasn't a pre-hire chat to avoid confusion
                    if (!preHireChat || preHireChat.length === 0) {
                        // logMessagesToHistory([fallbackToLog]);
                    }
                    setChatHistories(prev => ({ ...prev, [assistantId]: [...initialHistory, fallbackMessage] }));
                } finally {
                    setIsLoading(false);
                    onFirstViewCompleted?.();
                }
            };
            generateAndSetGreeting();
        } else if (!isFirstView && !hasBeenInitialized) {
            // Case C: Existing assistant, fetch history
            setIsLoading(true);
            const context = `${assistant.first_name}${assistant.surname}`;
            assistantActions.chat.getTranscripts(context)
                .then(historyResult => {
                    if ('detail' in historyResult) {
                        console.error(historyResult.detail);
                        setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                    } else {
                        const last10 = (historyResult as ChatMessage[]).slice(-10).reverse();
                        setChatHistories(prev => ({ ...prev, [assistantId]: last10 }));
                    }
                })
                .catch(err => {
                    console.error("Error fetching transcripts:", err);
                    setChatHistories(prev => ({ ...prev, [assistantId]: [] }));
                })
                .finally(() => {
                    setIsLoading(false);
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

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading || !assistant || !assistantId) return;

        const newUserMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        const currentMessages = [...messages, newUserMessage];
        setChatHistories(prev => ({ ...prev, [assistantId]: currentMessages }));
        setInputValue('');
        setIsLoading(true);

        const assistantResponseId = uuidv4();
        const assistantPlaceholder: ChatMessage = {
            id: assistantResponseId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
        };
        setChatHistories(prev => ({ ...prev, [assistantId]: [...prev[assistantId], assistantPlaceholder] }));

        try {
            // Create context from first and last name for the API call, removing all whitespace
            const apiContext = `${assistant.first_name}${assistant.surname}`;
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages.map(({ role, content }) => ({ role, content })),
                    assistantId: assistant.agent_id,
                    assistantName: apiContext, // Use the sanitized context here
                    assistantAge: assistant.age,
                    assistantBio: assistant.about,
                    assistantRegion: assistant.region,
                    type: 'profile',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "An unknown error occurred." }));
                throw new Error(errorData.detail || `Request failed with status ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("Failed to get response reader.");
            }
            const decoder = new TextDecoder();
            let finalAssistantResponse = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                finalAssistantResponse += chunk;
                setChatHistories(prev => {
                    const updatedHistory = prev[assistantId!].map(msg => 
                        msg.id === assistantResponseId ? { ...msg, content: finalAssistantResponse } : msg
                    );
                    return { ...prev, [assistantId!]: updatedHistory };
                });
            }

            const finalAssistantMessage: Omit<ChatMessage, 'id'> = {
                role: 'assistant',
                content: finalAssistantResponse,
                timestamp: new Date(),
            };
            
            // Log the user message and the final assistant response
            /* await logMessagesToHistory([
                { role: newUserMessage.role, content: newUserMessage.content, timestamp: newUserMessage.timestamp },
                finalAssistantMessage
            ]); */


        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to get profile chat response:", errorMessage);

            let displayError = `Sorry, I couldn't get a response. ${errorMessage}`;
            if (errorMessage.includes("INSUFFICIENT_CREDITS")) {
                displayError = `${INSUFFICIENT_CREDITS_MESSAGE} ${BILLING_URL}`;
            }

            setChatHistories(prev => {
                const updatedHistory = prev[assistantId!].map(msg => 
                    msg.id === assistantResponseId ? { ...msg, content: displayError } : msg
                );
                return { ...prev, [assistantId!]: updatedHistory };
            });

        } finally {
            setIsLoading(false);
        }
    };

    return {
        messages,
        inputValue,
        isLoading,
        handleInputChange,
        sendMessage,
    };
}