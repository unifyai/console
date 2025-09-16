import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { cn } from '@/lib/utils';
import { Input } from '@/components/UI/input';
import { useAssistantProfileChat } from '@/hooks/Assistants/useAssistantProfileChat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

const ChatMessageBubble = ({ message, isUser, assistantPhoto, assistantName, isLoading }: { message: string, isUser?: boolean, assistantPhoto?: string | null, assistantName?: string, isLoading?: boolean }) => {
    const fallback = assistantName ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase() : "A";

    const bubbleContent = () => {
        if (!isUser && isLoading && !message) {
            return (
                <div className="flex items-center space-x-1 px-2 text-muted-foreground">
                    <span className="text-caption">Typing</span>
                    <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce"></span>
                </div>
            );
        }
        return <div className="whitespace-pre-wrap">{message}</div>;
    };

    return (
        <div className={cn("flex items-start gap-3", isUser && "justify-end")}>
            {!isUser && (
                <Avatar className="h-8 w-8 border flex-shrink-0">
                    <AvatarImage src={assistantPhoto ?? undefined} alt={assistantName} />
                    <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
            )}
            <div className={cn("rounded-lg p-3 text-body max-w-[85%] break-words", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {bubbleContent()}
            </div>
        </div>
    );
};

interface AssistantProfileChatPanelProps {
    assistant: Assistant;
    assistantActions: AssistantActions;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
    isFirstView?: boolean;
    preHireChat?: ChatMessage[];
    onFirstViewCompleted?: () => void;
}


export function AssistantProfileChatPanel({ 
    assistant, 
    assistantActions,
    chatHistories,
    setChatHistories,
    isFirstView,
    preHireChat,
    onFirstViewCompleted,
}: AssistantProfileChatPanelProps) {
    
    const displayName = `${assistant.first_name} ${assistant.surname}`;
    const photoSrc = assistant.signedProfilePhotoUrl || (assistant.profile_photo ?? undefined);

    const { messages, inputValue, isLoading, handleInputChange, sendMessage } = useAssistantProfileChat(
        assistant, 
        assistantActions, 
        chatHistories, 
        setChatHistories,
        isFirstView,
        preHireChat,
        onFirstViewCompleted
    );
    const scrollAreaRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }, [messages]);

    const sendMessageOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevents adding a new line in the input
            // Create a synthetic event to pass to sendMessage, which expects a form event
            const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
            sendMessage(syntheticEvent);
        }
    };

    const isChatDisabled = isLoading;

    return (
        <div className="h-full flex flex-col w-full bg-background">
            {/* Chat Area */}
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <ChatMessageBubble
                            key={msg.id}
                            message={msg.content}
                            isUser={msg.role === 'user'}
                            assistantPhoto={photoSrc}
                            assistantName={displayName}
                            isLoading={isLoading && index === messages.length - 1 && msg.role === 'assistant'}
                        />
                    ))}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-4 bg-background">
                <div className="relative">
                     <Input
                        placeholder={"Send a message..."}
                        value={inputValue}
                        onChange={handleInputChange}
                        disabled={isChatDisabled}
                        className="pr-10 h-9"
                        autoComplete="off"
                        onKeyDown={sendMessageOnEnter}
                     />
                     <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" disabled={isChatDisabled || !inputValue.trim()}>
                        <Send className="h-4 w-4" />
                     </Button>
                 </div>
            </form>
        </div>
    );
}