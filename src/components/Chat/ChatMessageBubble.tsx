import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { cn } from '@/lib/utils';
import { Attachment } from '@/types/assistants/chat';
import { ChatMarkdown } from './ChatMarkdown';
import { RenderContentWithEmbeds, containsEmbedUrl } from './InlineEmbed';
import { MessageAttachmentList } from './ChatAttachments';

type ChatBubbleVariant = 'profile' | 'hire';

function formatMessageTime(date: Date, timezone?: string | null): string | null {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  if (timezone) options.timeZone = timezone;
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

function renderContentWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
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
}

interface ChatMessageBubbleProps {
  message: string;
  isUser?: boolean;
  assistantPhoto?: string | null;
  assistantName?: string;
  isLoading?: boolean;
  timestamp?: Date;
  timezone?: string | null;
  index?: number;
  attachments?: Attachment[];
  variant?: ChatBubbleVariant;
}

export function ChatMessageBubble({
  message,
  isUser,
  assistantPhoto,
  assistantName,
  isLoading,
  timestamp,
  timezone,
  index,
  attachments,
  variant = 'profile',
}: ChatMessageBubbleProps) {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';

  const timeString = timestamp ? formatMessageTime(timestamp, timezone) : null;
  const isProfile = variant === 'profile';

  const bubbleContent = () => {
    if (!isUser && isLoading && !message) {
      return (
        <div className="text-body-muted flex items-center gap-1.5">
          <span className="text-caption">Typing</span>
          <span className="flex items-center gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current opacity-60" />
          </span>
        </div>
      );
    }
    if (containsEmbedUrl(message)) {
      return (
        <div className="whitespace-pre-wrap">
          <RenderContentWithEmbeds content={message} expandedHeight={300} />
        </div>
      );
    }
    if (!isUser) {
      return <ChatMarkdown content={message} />;
    }
    if (variant === 'hire') {
      return <div className="whitespace-pre-wrap">{renderContentWithLinks(message)}</div>;
    }
    return <div className="whitespace-pre-wrap">{message}</div>;
  };

  if (isUser) {
    return (
      <div
        className="flex justify-end"
        data-testid={isProfile ? 'message-bubble' : undefined}
        data-role={isProfile ? 'user' : undefined}
        data-index={isProfile ? index : undefined}
      >
        <div className={cn('flex flex-col gap-2', isProfile ? 'max-w-[75%]' : 'max-w-[85%]')}>
          {attachments && attachments.length > 0 && (
            <MessageAttachmentList attachments={attachments} />
          )}
          <div
            className={cn(
              'break-words rounded-lg p-2.5 font-sans text-sm leading-snug',
              isProfile ? 'bg-primary text-primary-foreground' : 'bg-accent'
            )}
          >
            {bubbleContent()}
            {timeString && (
              <time
                className={cn(
                  'mt-1 block text-right text-[10px] leading-none',
                  isProfile ? 'opacity-60' : 'text-muted-foreground'
                )}
              >
                {timeString}
              </time>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={isProfile ? 'message-bubble' : undefined}
      data-role={isProfile ? 'assistant' : undefined}
      data-index={isProfile ? index : undefined}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Avatar className="h-6 w-6 flex-shrink-0 border">
          <AvatarImage src={assistantPhoto ?? undefined} alt={assistantName} />
          <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
        </Avatar>
        <span className="text-body-muted font-medium">{assistantName}</span>
        {timeString && (
          <time className="text-[10px] leading-none text-muted-foreground">{timeString}</time>
        )}
      </div>
      {attachments && attachments.length > 0 && <MessageAttachmentList attachments={attachments} />}
      <div className="break-words font-sans text-sm leading-relaxed">{bubbleContent()}</div>
    </div>
  );
}
