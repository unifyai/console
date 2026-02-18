import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { ChatMessage } from '@/types/assistants/chat';
import { sendPreHireChatMessage } from '@/lib/assistants/preHireChat';

const INSUFFICIENT_CREDITS_MESSAGE =
  "Sorry, I couldn't get that properly; it looks like a technical issue on my end. Maybe you could try refilling your credits balance? This should fix it.";
const BILLING_URL = 'https://console.unify.ai/billing';

export function useAssistantChat(
  assistantFirstName: string,
  assistantAge: number | null,
  assistantBio: string | null,
  configKey: string,
  histories: Record<string, ChatMessage[]>,
  setHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>
) {
  const messages = React.useMemo(() => histories[configKey] || [], [histories, configKey]);
  const [inputValue, setInputValue] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isInitialGreetingLoading, setIsInitialGreetingLoading] = React.useState(false);
  const [isTypingIndicatorVisible, setIsTypingIndicatorVisible] = React.useState(false);
  const typingDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const userMessageCount = React.useMemo(
    () => messages.filter((msg) => msg.role === 'user').length,
    [messages]
  );

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
      setHistories((prev) => ({ ...prev, [configKey]: [placeholderMessage] }));

      // Simulate typing delay
      const timer = setTimeout(() => {
        const greetingContent = `Hello! It's great to meet you. I'm ${assistantFirstName}. Feel free to ask me anything to see how I respond.`;

        // Now, update the placeholder with the actual greeting
        setHistories((prev) => {
          const currentHistory = prev[configKey] || [];
          const updatedHistory = currentHistory.map((msg) =>
            msg.id === placeholderMessageId ? { ...msg, content: greetingContent } : msg
          );
          return { ...prev, [configKey]: updatedHistory };
        });

        setIsInitialGreetingLoading(false);
      }, 1500); // 1.5 second typing simulation

      return () => clearTimeout(timer);
    }
    // By removing `histories` from the dependency array, we prevent this effect
    // from re-running every time we call `setHistories` inside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, assistantFirstName, setHistories]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // No message limit - users pay per message via credits
    if (!inputValue.trim() || isSending || isInitialGreetingLoading) return;

    const newUserMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    // Immediately update the history for the current key
    const currentMessages = [...messages, newUserMessage];
    setHistories((prev) => ({ ...prev, [configKey]: currentMessages }));
    setInputValue('');
    setIsSending(true);

    const assistantResponseId = uuidv4();

    // Add a slight delay before showing the typing indicator
    typingDelayRef.current = setTimeout(() => {
      setIsTypingIndicatorVisible(true);
      setHistories((prev) => ({
        ...prev,
        [configKey]: [
          ...prev[configKey],
          { id: assistantResponseId, role: 'assistant', content: '', timestamp: new Date() },
        ],
      }));
    }, 1200);

    try {
      // Use Server Action instead of API route - cannot be called directly via HTTP
      const result = await sendPreHireChatMessage(
        currentMessages.map(({ role, content }) => ({ role, content })),
        assistantFirstName,
        assistantAge,
        assistantBio
      );

      if (result.error) {
        throw new Error(result.error);
      }

      // Clear the typing delay timer since the response has arrived
      if (typingDelayRef.current) {
        clearTimeout(typingDelayRef.current);
        typingDelayRef.current = null;
      }

      // Update or insert the response message
      setHistories((prev) => {
        const currentHistory = prev[configKey] || [];
        const hasPlaceholder = currentHistory.some((msg) => msg.id === assistantResponseId);
        if (hasPlaceholder) {
          const updatedHistory = currentHistory.map((msg) =>
            msg.id === assistantResponseId ? { ...msg, content: result.content || '' } : msg
          );
          return { ...prev, [configKey]: updatedHistory };
        } else {
          return {
            ...prev,
            [configKey]: [
              ...currentHistory,
              {
                id: assistantResponseId,
                role: 'assistant',
                content: result.content || '',
                timestamp: new Date(),
              },
            ],
          };
        }
      });
    } catch (error) {
      // Clear the typing delay timer on error
      if (typingDelayRef.current) {
        clearTimeout(typingDelayRef.current);
        typingDelayRef.current = null;
      }

      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';

      if (errorMessage.includes('INSUFFICIENT_CREDITS')) {
        setHistories((prev) => {
          const currentHistory = prev[configKey] || [];
          const hasPlaceholder = currentHistory.some((msg) => msg.id === assistantResponseId);
          if (hasPlaceholder) {
            const updatedHistory = currentHistory.map((msg) =>
              msg.id === assistantResponseId
                ? { ...msg, content: `${INSUFFICIENT_CREDITS_MESSAGE} ${BILLING_URL}` }
                : msg
            );
            return { ...prev, [configKey]: updatedHistory };
          } else {
            return {
              ...prev,
              [configKey]: [
                ...currentHistory,
                {
                  id: assistantResponseId,
                  role: 'assistant',
                  content: `${INSUFFICIENT_CREDITS_MESSAGE} ${BILLING_URL}`,
                  timestamp: new Date(),
                },
              ],
            };
          }
        });
      } else {
        toast.error(`Failed to get a response. Please try again.`);
        setHistories((prev) => ({
          ...prev,
          [configKey]: (prev[configKey] || []).filter((msg) => msg.id !== assistantResponseId),
        }));
      }
    } finally {
      setIsSending(false);
      setIsTypingIndicatorVisible(false);
    }
  };

  return {
    messages,
    inputValue,
    isLoading: isSending || isInitialGreetingLoading,
    handleInputChange,
    sendMessage,
    userMessageCount,
  };
}
