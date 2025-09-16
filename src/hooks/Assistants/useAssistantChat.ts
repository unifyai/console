import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { ChatMessage } from '@/types/assistants/chat';

const USER_MESSAGE_LIMIT = 10;
const HIRE_ME_MESSAGE = "Glad I could be of help in this short conversation. Let's maybe resume after you've hired me? I'd be happy to pick up from there!";
const INSUFFICIENT_CREDITS_MESSAGE = "Sorry, I couldn't get that properly; it looks like a technical issue on my end. Maybe you could try refilling your credits balance? This should fix it.";
const BILLING_URL = "https://console.unify.ai/billing";

export function useAssistantChat(
    assistantFirstName: string,
    assistantAge: number | null,
    assistantBio: string | null,
    configKey: string,
    histories: Record<string, ChatMessage[]>,
    setHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>
) {
    const messages = histories[configKey] || [];
    const [inputValue, setInputValue] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [isInitialGreetingLoading, setIsInitialGreetingLoading] = React.useState(false);

    const userMessageCount = React.useMemo(() => 
        messages.filter(msg => msg.role === 'user').length,
    [messages]);

    // Effect to initialize conversation for a new/unseen assistant configuration
    React.useEffect(() => {
        // This effect should only run when the assistant identity (configKey) changes.
        // It should not re-run when the history for this assistant is populated.
        
        // Check if a conversation for this assistant has been started.
        if (!histories[configKey]) {
            setIsInitialGreetingLoading(true);
            const placeholderMessageId = uuidv4();

            // Add an empty placeholder message to trigger the "Typing..." UI
            const placeholderMessage: ChatMessage = {
                id: placeholderMessageId,
                role: 'assistant',
                content: '', // Empty content is key for the typing indicator
                timestamp: new Date(),
            };
            // We set the initial state for this configKey
            setHistories(prev => ({ ...prev, [configKey]: [placeholderMessage] }));

            // Simulate typing delay
            const timer = setTimeout(() => {
                const greetingContent = `Hello! It's great to meet you. I'm ${assistantFirstName}. Feel free to ask me anything to see how I respond.`;
                
                // Now, update the placeholder with the actual greeting
                setHistories(prev => {
                    const currentHistory = prev[configKey] || [];
                    const updatedHistory = currentHistory.map(msg =>
                        msg.id === placeholderMessageId
                            ? { ...msg, content: greetingContent }
                            : msg
                    );
                    return { ...prev, [configKey]: updatedHistory };
                });
                
                setIsInitialGreetingLoading(false);
            }, 1500); // 1.5 second typing simulation

            return () => clearTimeout(timer);
        }
    // By removing `histories` from the dependency array, we prevent this effect
    // from re-running every time we call `setHistories` inside it.
    }, [configKey, assistantFirstName, setHistories]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isSending || isInitialGreetingLoading || userMessageCount >= USER_MESSAGE_LIMIT) return;

        const newUserMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        // Immediately update the history for the current key
        const currentMessages = [...messages, newUserMessage];
        setHistories(prev => ({ ...prev, [configKey]: currentMessages }));
        setInputValue('');
        setIsSending(true);

        const assistantResponseId = uuidv4();
        // Add the empty placeholder for the assistant's response
        setHistories(prev => ({
            ...prev,
            [configKey]: [...prev[configKey], { id: assistantResponseId, role: 'assistant', content: '', timestamp: new Date() }]
        }));

        try {
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages.map(({ role, content }) => ({ role, content })),
                    assistantName: assistantFirstName,
                    assistantAge: assistantAge,
                    assistantBio: assistantBio,
                    type: 'hire',
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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                setHistories(prev => {
                    const updatedHistory = prev[configKey].map(msg =>
                        msg.id === assistantResponseId
                            ? { ...msg, content: msg.content + chunk }
                            : msg
                    );
                    return { ...prev, [configKey]: updatedHistory };
                });
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to get chat response:", errorMessage);

            if (errorMessage.includes("INSUFFICIENT_CREDITS")) {
                setHistories(prev => {
                    const updatedHistory = prev[configKey].map(msg => 
                        msg.id === assistantResponseId 
                        ? { ...msg, content: `${INSUFFICIENT_CREDITS_MESSAGE} ${BILLING_URL}` }
                        : msg
                    );
                    return { ...prev, [configKey]: updatedHistory };
                });
            } else {
                toast.error(`Sorry, I couldn't get a response. ${errorMessage}`);
                // Remove the empty assistant message placeholder on error
                setHistories(prev => ({
                    ...prev,
                    [configKey]: prev[configKey].filter(msg => msg.id !== assistantResponseId)
                }));
            }

        } finally {
            setIsSending(false);
            // Check if the user has now sent their message limit
            const finalUserMessageCount = (histories[configKey] || []).filter(m => m.role === 'user').length;
            if (finalUserMessageCount >= USER_MESSAGE_LIMIT) {
                setHistories(prev => ({
                    ...prev,
                    [configKey]: [...prev[configKey], { id: uuidv4(), role: 'assistant', content: HIRE_ME_MESSAGE, timestamp: new Date() }]
                }));
            }
        }
    };

    return {
        messages,
        inputValue,
        isLoading: isSending || isInitialGreetingLoading,
        handleInputChange,
        sendMessage,
        userMessageCount,
        USER_MESSAGE_LIMIT
    };
}