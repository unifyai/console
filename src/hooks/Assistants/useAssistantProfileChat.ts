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

    React.useEffect(() => {
        if (!assistantId || !assistant) return;

        const hasBeenInitialized = (chatHistories[assistantId]?.length || 0) > 0;

        if (isFirstView && !firstViewProcessed.current) {
            firstViewProcessed.current = true;
            const generateAndSetGreeting = async () => {
                setIsLoading(true);
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
            const response = await assistantActions.chat.message({
                assistant_id: parseInt(assistant.agent_id),
                contact_id: 1,
                message: newUserMessage.content
            });

            if (response.detail || !response.info) {
                throw new Error(response.detail || "The assistant did not return a message.");
            }

            const assistantResponseContent = response.info;

            setChatHistories(prev => {
                const updatedHistory = prev[assistantId!].map(msg =>
                    msg.id === assistantResponseId ? { ...msg, content: assistantResponseContent } : msg
                );
                return { ...prev, [assistantId!]: updatedHistory };
            });

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
