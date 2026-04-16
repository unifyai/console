import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Volume2, Loader2, Square } from 'lucide-react';
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
  onPlayAudio?: () => void;
  onStopAudio?: () => void;
  audioState?: 'idle' | 'generating' | 'playing';
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
  onPlayAudio,
  onStopAudio,
  audioState = 'idle',
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
    if (!isUser) {
      return <ChatMarkdown content={message} />;
    }
    if (containsEmbedUrl(message)) {
      return (
        <div className="whitespace-pre-wrap">
          <RenderContentWithEmbeds content={message} expandedHeight={420} />
        </div>
      );
    }
    if (variant === 'hire') {
      return <div className="whitespace-pre-wrap">{renderContentWithLinks(message)}</div>;
    }
    return <div className="whitespace-pre-wrap">{message}</div>;
  };

  if (isUser) {
    return (
      <div
        className="flex min-w-0 justify-end"
        data-testid={isProfile ? 'message-bubble' : undefined}
        data-role={isProfile ? 'user' : undefined}
        data-index={isProfile ? index : undefined}
      >
        <div
          className={cn(
            'flex min-w-0 flex-col gap-2',
            isProfile ? 'max-w-[85%] md:max-w-[55%]' : 'max-w-[85%]'
          )}
        >
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
      className={cn('min-w-0', isProfile && 'md:max-w-[55%]')}
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
        {onPlayAudio && (
          <button
            type="button"
            onClick={audioState === 'playing' ? onStopAudio : onPlayAudio}
            disabled={audioState === 'generating'}
            className={cn(
              'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors',
              audioState === 'playing'
                ? 'hover:text-primary/80 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground'
            )}
          >
            {audioState === 'generating' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {audioState === 'playing' && <Square className="h-3 w-3 fill-current" />}
            {audioState === 'idle' && <Volume2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {attachments && attachments.length > 0 && (
        <MessageAttachmentList attachments={attachments} isAssistant />
      )}
      <div className="min-w-0 break-words font-sans text-sm leading-relaxed">{bubbleContent()}</div>
    </div>
  );
}
