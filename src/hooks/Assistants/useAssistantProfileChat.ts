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
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>
) {
    const assistantId = assistant?.agent_id || null;
    const messages = assistantId ? chatHistories[assistantId] || [] : [];
    
    const [inputValue, setInputValue] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (assistantId && !chatHistories[assistantId]) {
            const initialMessage: ChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: `Hey, great to see you again! Feel free to message here, text or call me on my phone whenever.`,
                timestamp: new Date(),
            };
            setChatHistories(prev => ({ ...prev, [assistantId]: [initialMessage] }));
        }
    }, [assistantId, chatHistories, setChatHistories]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };
    
    const logMessagesToHistory = async (newMessages: Omit<ChatMessage, 'id'>[]) => {
        if (!assistant) return;
        // Create context from first and last name, removing all whitespace
        const context = `${assistant.first_name}${assistant.surname}`;
        try {
            await assistantActions.chat.updateTranscripts(context, newMessages);
        } catch (error) {
            console.error("Failed to log chat history:", error);
            // Non-critical, so we don't show a user-facing toast
        }
    };

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
            await logMessagesToHistory([
                { role: newUserMessage.role, content: newUserMessage.content, timestamp: newUserMessage.timestamp },
                finalAssistantMessage
            ]);


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