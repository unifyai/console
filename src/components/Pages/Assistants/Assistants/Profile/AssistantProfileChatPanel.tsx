import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Send, Loader2, MessageSquareMore } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/UI/textarea';
import { useAssistantProfileChat } from '@/hooks/Assistants/useAssistantProfileChat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';
import { RenderContentWithEmbeds, containsEmbedUrl } from '@/components/Chat';

/* ---------------------
   ChatMessageBubble
------------------------ */
const ChatMessageBubble = ({
  message,
  isUser,
  assistantPhoto,
  assistantName,
  isLoading,
  index,
}: {
  message: string;
  isUser?: boolean;
  assistantPhoto?: string | null;
  assistantName?: string;
  isLoading?: boolean;
  index?: number;
}) => {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';

  const bubbleContent = () => {
    if (!isUser && isLoading && !message) {
      return (
        <div className="flex items-center space-x-1 px-2 text-muted-foreground">
          <span className="text-caption">Typing</span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
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
    return <div className="whitespace-pre-wrap">{message}</div>;
  };

  return (
    <div
      className={cn('flex items-start gap-3', isUser && 'justify-end')}
      data-testid="message-bubble"
      data-role={isUser ? 'user' : 'assistant'}
      data-index={index}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 flex-shrink-0 border">
          <AvatarImage src={assistantPhoto ?? undefined} alt={assistantName} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'text-body max-w-[75%] break-words rounded-lg p-3',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {bubbleContent()}
      </div>
    </div>
  );
};

/* --------------------------
   AssistantProfileChatPanel 
----------------------------- */
interface AssistantProfileChatPanelProps {
  assistant: Assistant;
  assistantActions: Pick<AssistantActions, 'chat'>;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  userEmail: string | null | undefined;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
}

export function AssistantProfileChatPanel({
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  userEmail,
  isFirstView,
  preHireChat,
  onFirstViewCompleted,
}: AssistantProfileChatPanelProps) {
  const displayName = `${assistant.firstName} ${assistant.surname}`;
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto || undefined;

  const {
    messages,
    inputValue,
    isLoading,
    initialLoadError,
    retryInitialLoad,
    isAssistantReplying,
    handleInputChange,
    sendMessage,
    connectionStatus,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore,
    loadMoreError,
    hasFetchedHistory,
    canChat,
  } = useAssistantProfileChat(
    assistant,
    assistantActions,
    chatHistories,
    setChatHistories,
    userEmail,
    isFirstView,
    preHireChat,
    onFirstViewCompleted
  );

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const preserveScrollRef = React.useRef<number | null>(null);

  /* Auto-resize textarea */
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

  /* Infinite scroll trigger */
  React.useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );
    if (!viewport) return;
    const handleScroll = () => {
      if (
        viewport.scrollTop < 10 &&
        hasMoreMessages &&
        !isLoadingMore &&
        !isLoading &&
        !loadMoreError &&
        !initialLoadError
      ) {
        preserveScrollRef.current = viewport.scrollHeight;
        loadMoreMessages();
      }
    };
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [
    hasMoreMessages,
    isLoadingMore,
    isLoading,
    loadMoreMessages,
    loadMoreError,
    initialLoadError,
  ]);

  /* Scroll position preservation when loading older messages */
  React.useLayoutEffect(() => {
    if (preserveScrollRef.current !== null) {
      const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
        '[data-radix-scroll-area-viewport]'
      );
      if (viewport) {
        const newHeight = viewport.scrollHeight;
        const diff = newHeight - preserveScrollRef.current;
        if (diff > 0) {
          viewport.scrollTop = diff;
        }
        preserveScrollRef.current = null;
      }
    }
  }, [messages]);

  /* Auto-scroll behavior (bottom stickiness) */
  React.useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );
    if (!viewport) return;

    const prevScrollHeight = prevScrollHeightRef.current;
    const { scrollTop, scrollHeight, clientHeight } = viewport;

    const wasBottom =
      prevScrollHeight === null || prevScrollHeight - scrollTop - clientHeight <= 20;

    // Only auto-scroll to bottom if we aren't currently loading old history (which keeps us at top)
    if (scrollHeight !== prevScrollHeight && wasBottom && !isLoadingMore) {
      viewport.scrollTop = scrollHeight;
    }

    prevScrollHeightRef.current = scrollHeight;
  }, [messages, isAssistantReplying, isLoadingMore]);

  const sendMessageOnEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage({ preventDefault: () => {} } as React.FormEvent);
    }
  };

  const connectionStatusText = {
    connected: 'Connected',
    connecting: 'Connecting...',
    reconnecting: 'Connection lost. Reconnecting...',
    error: 'Connection failed. Please refresh.',
  }[connectionStatus];

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Chat Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef} data-testid="chat-scroll-area">
        {!canChat ? (
          <div className="animate-fade-in flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">Chat is not available</p>
              <p className="text-xs opacity-80">Please try again in a few minutes</p>
            </div>
          </div>
        ) : initialLoadError ? (
          <div className="animate-fade-in flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">Failed to load chat history</p>
              <p className="text-xs opacity-80">Please check your connection</p>
            </div>
            <Button variant="outline" size="sm" onClick={retryInitialLoad} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {hasFetchedHistory && !hasMoreMessages && (
              <div className="text-caption animate-fade-in w-full py-1 text-center text-muted-foreground">
                No more messages
              </div>
            )}
            {isLoadingMore && (
              <div className="text-caption flex w-full flex-row justify-center gap-2 py-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading messages
              </div>
            )}
            {loadMoreError && (
              <div className="animate-fade-in flex w-full flex-col items-center gap-2 py-1">
                <Button
                  role="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
                      '[data-radix-scroll-area-viewport]'
                    );
                    if (viewport) preserveScrollRef.current = viewport.scrollHeight;
                    loadMoreMessages();
                  }}
                  className="text-caption h-3"
                >
                  Failed to load more. Retry
                </Button>
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg.content}
                isUser={msg.role === 'user'}
                assistantPhoto={photoSrc}
                assistantName={displayName}
                index={i}
              />
            ))}
            {isAssistantReplying && (
              <ChatMessageBubble
                key="typing-indicator"
                message=""
                isUser={false}
                assistantPhoto={photoSrc}
                assistantName={displayName}
                isLoading={true}
                index={messages.length}
              />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Connection status */}
      {!initialLoadError && connectionStatus !== 'connected' && connectionStatusText && (
        <div className="text-caption flex animate-pulse flex-row gap-2 px-4 text-muted-foreground">
          <MessageSquareMore className="h-4 w-4" />
          {connectionStatusText}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={sendMessage} className="bg-background p-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              !canChat
                ? 'Chat disabled'
                : initialLoadError
                  ? 'Connection failed'
                  : isLoading
                    ? 'Loading messages...'
                    : 'Send a message...'
            }
            value={inputValue}
            onChange={handleInputChange}
            disabled={!canChat || isLoading || initialLoadError || connectionStatus !== 'connected'}
            className="text-body min-h-[36px] resize-none overflow-y-hidden pr-10"
            autoComplete="off"
            onKeyDown={sendMessageOnEnter}
          />

          <Button
            type="submit"
            aria-label="Send message"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            disabled={
              !canChat ||
              isLoading ||
              !inputValue.trim() ||
              initialLoadError ||
              connectionStatus !== 'connected'
            }
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
