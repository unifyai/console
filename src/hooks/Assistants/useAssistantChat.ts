import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { ChatMessage } from '@/types/assistants/chat';

const USER_MESSAGE_LIMIT = 10;
const HIRE_ME_MESSAGE = "Glad I could be of help in this short conversation. Let's maybe resume after you've hired me? I'd be happy to pick up from there!";
const INSUFFICIENT_CREDITS_MESSAGE = "Sorry, I couldn't get that to you properly; it looks like a technical issue on my end. Maybe you could try refilling your credits balance? This should fix it.";
const BILLING_URL = "https://console.unify.ai/billing";

export function useAssistantChat(assistantFirstName: string) {
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    const userMessageCount = React.useMemo(() => 
        messages.filter(msg => msg.role === 'user').length,
    [messages]);

    // Initial message from the assistant
    React.useEffect(() => {
        setMessages([
            {
                id: uuidv4(),
                role: 'assistant',
                content: `Hello! It's great to meet you. I'm ${assistantFirstName}. Feel free to ask me anything to see how I respond.`,
            },
        ]);
    }, [assistantFirstName]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading || userMessageCount >= USER_MESSAGE_LIMIT) return;

        const newUserMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: inputValue.trim(),
        };

        const currentMessages = [...messages, newUserMessage];
        setMessages(currentMessages);
        setInputValue('');
        setIsLoading(true);

        const assistantResponseId = uuidv4();
        setMessages(prev => [...prev, { id: assistantResponseId, role: 'assistant', content: '' }]);

        try {
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages.map(({ role, content }) => ({ role, content })),
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
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantResponseId
                            ? { ...msg, content: msg.content + chunk }
                            : msg
                    )
                );
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to get chat response:", errorMessage);

            if (errorMessage.includes("INSUFFICIENT_CREDITS")) {
                setMessages(prev => prev.map(msg => 
                    msg.id === assistantResponseId 
                    ? { ...msg, content: `${INSUFFICIENT_CREDITS_MESSAGE} ${BILLING_URL}` }
                    : msg
                ));
            } else {
                toast.error(`Sorry, I couldn't get a response. ${errorMessage}`);
                setMessages(prev => prev.filter(msg => msg.id !== assistantResponseId));
            }

        } finally {
            setIsLoading(false);
            // Check if the user has now sent their 10th message
            const finalUserMessageCount = currentMessages.filter(m => m.role === 'user').length;
            if (finalUserMessageCount >= USER_MESSAGE_LIMIT) {
                setMessages(prev => [
                    ...prev,
                    { id: uuidv4(), role: 'assistant', content: HIRE_ME_MESSAGE }
                ]);
            }
        }
    };

    return {
        messages,
        inputValue,
        isLoading,
        handleInputChange,
        sendMessage,
        userMessageCount,
        USER_MESSAGE_LIMIT
    };
}