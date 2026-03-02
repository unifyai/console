import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Send, Loader2, MessageSquareMore, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/UI/textarea';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useAssistantProfileChat } from '@/hooks/Assistants/useAssistantProfileChat';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage, Attachment } from '@/types/assistants/chat';
import {
  PendingAttachmentList,
  createAttachment,
  validateFile,
  ChatMessageBubble,
  ChatDateDivider,
  isSameDay,
  MAX_ATTACHMENTS,
} from '@/components/Chat';
import { SpendingGateStatus, DEFAULT_SPENDING_GATE_STATUS } from '@/types/assistants/spendingGate';

/* --------------------------
   AssistantProfileChatPanel 
----------------------------- */
interface AssistantProfileChatPanelProps {
  assistant: Assistant;
  assistantActions: Pick<AssistantActions, 'chat'>;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  userEmail: string | null | undefined;
  userTimezone?: string | null;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
  /** Spending gate status for blocking new messages */
  spendingGate?: SpendingGateStatus;
}

export function AssistantProfileChatPanel({
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  userEmail,
  userTimezone,
  isFirstView,
  preHireChat,
  onFirstViewCompleted,
  spendingGate = DEFAULT_SPENDING_GATE_STATUS,
}: AssistantProfileChatPanelProps) {
  const displayName = `${assistant.firstName} ${assistant.surname}`;
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto || undefined;

  // Spending gate blocks new messages when limit is reached
  const isSpendingBlocked = spendingGate.isBlocked;

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
    isRetryingContactId,
    reconnectSSE,
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
  const prevSpendingBlockedRef = React.useRef<boolean>(isSpendingBlocked);

  // Attachment state
  const [pendingAttachments, setPendingAttachments] = React.useState<Attachment[]>([]);

  /* Cleanup on unmount to release File object references */
  React.useEffect(() => {
    return () => {
      setPendingAttachments([]);
    };
  }, []);

  /* Force SSE reconnection when spending becomes unblocked.
   * This ensures the SSE connection is fresh after spending limit changes,
   * preventing stale connections that might not deliver messages. */
  React.useEffect(() => {
    if (prevSpendingBlockedRef.current && !isSpendingBlocked) {
      // Spending just became unblocked - reconnect SSE to ensure fresh connection
      reconnectSSE();
    }
    prevSpendingBlockedRef.current = isSpendingBlocked;
  }, [isSpendingBlocked, reconnectSSE]);

  /* File handling */
  const handleFiles = React.useCallback(
    (files: File[]) => {
      const remaining = MAX_ATTACHMENTS - pendingAttachments.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} attachments per message`);
        return;
      }

      const filesToAdd = files.slice(0, remaining);
      const newAttachments: Attachment[] = [];

      for (const file of filesToAdd) {
        const validation = validateFile(file);
        if (!validation.valid) {
          toast.error(validation.error);
          continue;
        }
        // Check for duplicates
        if (pendingAttachments.some((a) => a.filename === file.name && a.sizeBytes === file.size)) {
          continue; // Silent skip duplicates
        }
        newAttachments.push(createAttachment(file));
      }

      if (newAttachments.length > 0) {
        setPendingAttachments((prev) => [...prev, ...newAttachments]);
      }
    },
    [pendingAttachments]
  );

  const removeAttachment = React.useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  /* react-dropzone setup */
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleFiles,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  /* Auto-resize textarea (ChatGPT-style: grows with content, scrollbar after max) */
  const TEXTAREA_MAX_HEIGHT = 200;

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';
    textarea.style.scrollbarWidth = 'none';

    if (inputValue) {
      const scrollHeight = textarea.scrollHeight;

      if (scrollHeight > TEXTAREA_MAX_HEIGHT) {
        textarea.style.height = `${TEXTAREA_MAX_HEIGHT}px`;
        textarea.style.overflowY = 'auto';
        textarea.style.scrollbarWidth = 'thin';
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

  /* Handle send with attachments */
  const handleSendWithAttachments = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() && pendingAttachments.length === 0) return;

      // Store attachments to send
      const attachmentsToSend = [...pendingAttachments];

      // Clear pending attachments optimistically
      setPendingAttachments([]);

      // Call send with attachments, with error callback to restore on failure
      sendMessage(e, attachmentsToSend, (failedAttachments) => {
        // Use functional update to preserve any attachments added while request was in-flight
        setPendingAttachments((prev) => [...failedAttachments, ...prev]);
      });
    },
    [inputValue, pendingAttachments, sendMessage]
  );

  const sendMessageOnEnter = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendWithAttachments({ preventDefault: () => {} } as React.FormEvent);
      }
    },
    [handleSendWithAttachments]
  );

  const connectionStatusText = {
    connected: 'Connected',
    connecting: 'Connecting...',
    reconnecting: 'Connection lost. Reconnecting...',
    error: 'Connection failed. Please refresh.',
  }[connectionStatus];

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Chat Area */}
      <ScrollArea className="flex-1 px-14 py-4" ref={scrollAreaRef} data-testid="chat-scroll-area">
        {initialLoadError ? (
          <div className="animate-fade-in flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="space-y-1 text-center">
              <p className="text-title">Failed to load chat history</p>
              <p className="text-caption opacity-80">Please check your connection</p>
            </div>
            <Button variant="outline" size="sm" onClick={retryInitialLoad} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Retry
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-[720px] space-y-6">
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
            {messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const showDivider =
                !prevMsg || !isSameDay(prevMsg.timestamp, msg.timestamp, userTimezone);
              return (
                <React.Fragment key={msg.id}>
                  {showDivider && <ChatDateDivider date={msg.timestamp} timezone={userTimezone} />}
                  <ChatMessageBubble
                    message={msg.content}
                    isUser={msg.role === 'user'}
                    assistantPhoto={photoSrc}
                    assistantName={displayName}
                    timestamp={msg.timestamp}
                    timezone={userTimezone}
                    index={i}
                    attachments={msg.attachments}
                  />
                </React.Fragment>
              );
            })}
            {isAssistantReplying && (
              <ChatMessageBubble
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
      <form onSubmit={handleSendWithAttachments} className="bg-background p-4">
        <div
          {...getRootProps()}
          className={cn('relative', isDragActive && 'rounded-md ring-2 ring-primary ring-offset-2')}
          data-testid="chat-dropzone"
        >
          {/* Drag-and-drop overlay */}
          {isDragActive && (
            <div className="bg-primary/10 absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary">
              <span className="font-medium text-primary">Drop files here</span>
            </div>
          )}

          {/* Pending attachments */}
          {pendingAttachments.length > 0 && (
            <PendingAttachmentList
              attachments={pendingAttachments}
              onRemove={removeAttachment}
              className="mb-2"
            />
          )}

          {/* Hidden file input — getInputProps() owns the ref and hides the
             element via clip/position:absolute. Do NOT override the ref or add
             display:none; doing so breaks multi-file selection in some browsers. */}
          <input {...getInputProps()} data-testid="file-input" />

          <div className="relative">
            {/* Paperclip button - bottom left */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute bottom-1 left-1 h-7 w-7"
              onClick={open}
              disabled={
                !canChat ||
                isLoading ||
                initialLoadError ||
                connectionStatus !== 'connected' ||
                isSpendingBlocked
              }
              aria-label="Attach files"
              data-testid="attach-button"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Textarea
              ref={textareaRef}
              rows={1}
              placeholder={
                !canChat
                  ? isRetryingContactId
                    ? 'Chat unavailable, retrying connection...'
                    : 'Chat unavailable'
                  : isSpendingBlocked
                    ? spendingGate.blockedMessage || 'Spending limit reached'
                    : initialLoadError
                      ? 'Connection failed'
                      : isLoading
                        ? 'Loading messages...'
                        : 'Send a message...'
              }
              value={inputValue}
              onChange={handleInputChange}
              disabled={
                !canChat ||
                isLoading ||
                initialLoadError ||
                connectionStatus !== 'connected' ||
                isSpendingBlocked
              }
              className="styled-scrollbar text-body min-h-[36px] resize-none overflow-y-hidden pl-10 pr-10"
              autoComplete="off"
              onKeyDown={sendMessageOnEnter}
            />

            {/* Send button - bottom right */}
            <Button
              type="submit"
              aria-label="Send message"
              size="icon"
              className="absolute bottom-1 right-1 h-7 w-7"
              disabled={
                !canChat ||
                isLoading ||
                (!inputValue.trim() && pendingAttachments.length === 0) ||
                initialLoadError ||
                connectionStatus !== 'connected' ||
                isSpendingBlocked
              }
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
