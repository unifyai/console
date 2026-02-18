import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Send, Loader2, LayoutList, Minimize2, Maximize2, Minus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { cn } from '@/lib/utils';
import { useFormContext } from 'react-hook-form';
import { AssistantFormData } from '@/types/assistants/assistant';
import { Textarea } from '@/components/UI/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { useAssistantChat } from '@/hooks/Assistants/useAssistantChat';
import { ChatMessage } from '@/types/assistants/chat';
import { RenderContentWithEmbeds, containsEmbedUrl } from '@/components/Chat';
import { PRE_HIRE_CHAT_MESSAGE_COST } from '@/constants/assistants/settings';

interface AssistantHireChatPanelProps {
  onClose: () => void;
  layoutMode: 'split' | 'left' | 'right';
  setLayoutMode: React.Dispatch<React.SetStateAction<'split' | 'left' | 'right'>>;
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
          className="text-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

const ChatMessageBubble = ({
  message,
  isUser,
  assistantPhoto,
  assistantName,
  isLoading,
}: {
  message: string;
  isUser?: boolean;
  assistantPhoto?: string | null;
  assistantName?: string;
  isLoading?: boolean;
}) => {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';

  const bubbleContent = () => {
    if (!isUser && isLoading && !message) {
      return (
        <div className="flex items-center space-x-1 px-2 text-muted-foreground">
          <span className="text-caption">Typing</span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"></span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"></span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"></span>
        </div>
      );
    }
    // Check if message contains embeddable URLs (tables/plots)
    if (containsEmbedUrl(message)) {
      return (
        <div className="whitespace-pre-wrap">
          <RenderContentWithEmbeds content={message} expandedHeight={300} />
        </div>
      );
    }
    return <div className="whitespace-pre-wrap">{renderContentWithLinks(message)}</div>;
  };

  return (
    <div className={cn('flex items-start gap-3', isUser && 'justify-end')}>
      {!isUser && (
        <Avatar className="h-8 w-8 flex-shrink-0 border">
          <AvatarImage src={assistantPhoto ?? undefined} alt={assistantName} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[85%] break-words rounded-lg p-3 font-sans text-sm leading-snug',
          isUser ? 'bg-accent' : 'bg-muted'
        )}
      >
        {bubbleContent()}
      </div>
    </div>
  );
};

export function AssistantHireChatPanel({
  onClose,
  layoutMode,
  setLayoutMode,
  assistantConfigKey,
  chatHistories,
  setChatHistories,
  onToggleView,
}: AssistantHireChatPanelProps) {
  const { watch } = useFormContext<AssistantFormData>();
  const photoPreviewUrl = watch('photoPreviewUrl');
  const firstName = watch('firstName', 'New');
  const surname = watch('surname', 'Assistant');
  const age = watch('age');
  const bio = watch('about');
  const displayName = `${firstName} ${surname}`;

  const { messages, inputValue, isLoading, handleInputChange, sendMessage } = useAssistantChat(
    firstName,
    age,
    bio,
    assistantConfigKey,
    chatHistories,
    setChatHistories
  );
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content, capped at 3 rows
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';

    if (inputValue) {
      const scrollHeight = textarea.scrollHeight;
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
      const paddingTop = parseFloat(computedStyle.paddingTop);
      const paddingBottom = parseFloat(computedStyle.paddingBottom);
      const maxLines = 3;
      const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;

      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${scrollHeight}px`;
      }
    }
  }, [inputValue]);

  React.useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );
    if (!viewport) return;

    const prevScrollHeight = prevScrollHeightRef.current;
    const { scrollTop, scrollHeight, clientHeight } = viewport;

    // A small buffer to prevent issues with fractional pixels.
    const scrollBuffer = 10;

    // Determine if the user was scrolled to the bottom before new messages were added.
    // `prevScrollHeight` will be null on the first render, causing an initial scroll to bottom.
    const wasScrolledToBottom =
      prevScrollHeight === null || prevScrollHeight - scrollTop - clientHeight <= scrollBuffer;

    // If new content has been added and the user was at the bottom, auto-scroll.
    if (scrollHeight !== prevScrollHeight && wasScrolledToBottom) {
      viewport.scrollTop = scrollHeight;
    }
    prevScrollHeightRef.current = scrollHeight;
  }, [messages]);

  // Chat is only disabled while loading - no message limit since users pay per message
  const isChatDisabled = isLoading;

  return (
    <div className="flex h-full w-full flex-col border-l bg-background">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b p-4">
        <h2 className="text-title truncate pr-2">Chat with {displayName}</h2>
        <div className="flex items-center gap-1">
          {layoutMode === 'split' && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setLayoutMode('left')}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Minimize panel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setLayoutMode(layoutMode === 'right' ? 'split' : 'right')}
                  disabled={layoutMode === 'left'}
                >
                  {layoutMode === 'right' ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{layoutMode === 'right' ? 'Shrink panel' : 'Maximize panel'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
      <form onSubmit={sendMessage} className="border-t bg-background p-4">
        <div className="mb-2 text-left">
          <span className="text-caption text-muted-foreground">
            `Cost: {PRE_HIRE_CHAT_MESSAGE_COST} credits per message`
          </span>
        </div>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            rows={1}
            placeholder="Send a message..."
            value={inputValue}
            onChange={handleInputChange}
            disabled={isChatDisabled}
            className="text-body min-h-[36px] resize-none overflow-y-hidden pr-10"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isChatDisabled && inputValue.trim()) {
                  sendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
                }
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-1.5 right-1.5 h-7 w-7"
            disabled={isChatDisabled || !inputValue.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
