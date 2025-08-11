import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { X, PanelRightOpen, Send, PanelLeftClose, Loader2, Maximize, Minimize, LayoutList, Minimize2, Maximize2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { cn } from '@/lib/utils';
import { useFormContext } from 'react-hook-form';
import { AssistantFormData } from '@/types/assistants/assistant';
import { Input } from '@/components/UI/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { useAssistantChat } from '@/hooks/Assistants/useAssistantChat';
import { ChatMessage } from '@/types/assistants/chat';

interface AssistantHireChatPanelProps {
  onClose: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
  assistantConfigKey: string;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  onToggleView?: () => void;
}

// Helper function to render text with clickable links
const renderContentWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80"
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }
        return part;
    });
};

const ChatMessageBubble = ({ message, isUser, assistantPhoto, assistantName, isLoading }: { message: string, isUser?: boolean, assistantPhoto?: string | null, assistantName?: string, isLoading?: boolean }) => {
    const fallback = assistantName ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase() : "A";

    const bubbleContent = () => {
        if (!isUser && isLoading && !message) {
            return (
                <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
            );
        }
        return <div className="whitespace-pre-wrap">{renderContentWithLinks(message)}</div>;
    };

    return (
        <div className={cn("flex items-start gap-3", isUser && "justify-end")}>
            {!isUser && (
                <Avatar className="h-8 w-8 border flex-shrink-0">
                    <AvatarImage src={assistantPhoto ?? undefined} alt={assistantName} />
                    <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
            )}
            <div className={cn("rounded-lg p-3 text-sm max-w-[85%] break-words", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {bubbleContent()}
            </div>
        </div>
    )
};

export function AssistantHireChatPanel({
    onClose,
    onToggleExpand,
    isExpanded,
    assistantConfigKey,
    chatHistories,
    setChatHistories,
    onToggleView,
}: AssistantHireChatPanelProps) {
    const { watch } = useFormContext<AssistantFormData>();
    const photoPreviewUrl = watch("photoPreviewUrl");
    const firstName = watch("first_name", "New");
    const surname = watch("surname", "Assistant");
    const age = watch("age");
    const bio = watch("about");
    const displayName = `${firstName} ${surname}`;

    const { messages, inputValue, isLoading, handleInputChange, sendMessage, userMessageCount, USER_MESSAGE_LIMIT } = useAssistantChat(firstName, age, bio, assistantConfigKey, chatHistories, setChatHistories);
    const scrollAreaRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }, [messages]);

    const isChatDisabled = isLoading || userMessageCount >= USER_MESSAGE_LIMIT;

    return (
        <div className="h-full flex flex-col w-full bg-background border-l">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold truncate pr-2">Chat with {displayName}</h2>
                <div className="flex items-center gap-1">
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleView}>
                                    <LayoutList className="h-4 w-4" />
                                    <span className="sr-only">Show Presets</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Show Presets</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {isExpanded ? (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
                                        <Minimize2 className="h-4 w-4" />
                                        <span className="sr-only">Minimize panel</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p>Minimize panel</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
                                        <Maximize2 className="h-4 w-4" />
                                        <span className="sr-only">Maximize panel</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p>Maximize panel</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <ChatMessageBubble
                            key={msg.id}
                            message={msg.content}
                            isUser={msg.role === 'user'}
                            assistantPhoto={photoPreviewUrl}
                            assistantName={displayName}
                            isLoading={isLoading && index === messages.length - 1 && msg.role === 'assistant'}
                        />
                    ))}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-4 border-t bg-background">
                <div className="relative">
                     <Input
                        placeholder={userMessageCount >= USER_MESSAGE_LIMIT ? "Message limit reached." : "Send a message..."}
                        value={inputValue}
                        onChange={handleInputChange}
                        disabled={isChatDisabled}
                        className="pr-10 h-9"
                        autoComplete="off"
                     />
                     <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" disabled={isChatDisabled || !inputValue.trim()}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                     </Button>
                 </div>
            </form>
        </div>
    );
}