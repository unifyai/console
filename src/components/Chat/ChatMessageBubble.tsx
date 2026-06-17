import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Volume2, Loader2, Square, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { Attachment } from '@/types/assistants/chat';
import { ChatMarkdown } from './ChatMarkdown';
import { RenderContentWithEmbeds, containsEmbedUrl } from './InlineEmbed';
import { MessageAttachmentList } from './ChatAttachments';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { TooltipContent, Tooltip, TooltipTrigger, TooltipProvider } from '@/components/UI/tooltip';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { AssistantStartCallButton } from '@/components/Pages/Assistants/Communication/AssistantStartCallButton';
import { DroidCallAvatar } from '@/components/Pages/Assistants/Communication/DroidCallAvatar';
import { useDroidAudioElementLipsync } from '@/utils/assistants/droid-lipsync';

type ChatBubbleVariant = 'profile' | 'hire';

// `Intl.DateTimeFormat` construction is surprisingly expensive (allocates an
// ICU formatter under the hood). Long conversations call `formatMessageTime`
// once per bubble per render, so we cache one formatter per timezone and
// reuse it across every bubble. Keyed on the resolved timezone string
// (`'__local__'` for the implicit local zone) so each user only ever sees a
// handful of entries even across timezone switches.
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();
function getMessageTimeFormatter(timezone?: string | null): Intl.DateTimeFormat {
  const key = timezone || '__local__';
  let formatter = dateTimeFormatCache.get(key);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    if (timezone) options.timeZone = timezone;
    formatter = new Intl.DateTimeFormat('en-GB', options);
    dateTimeFormatCache.set(key, formatter);
  }
  return formatter;
}

function formatMessageTime(date: Date, timezone?: string | null): string | null {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  return getMessageTimeFormatter(timezone).format(date);
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
  isCoordinator?: boolean;
  isLoading?: boolean;
  timestamp?: Date;
  timezone?: string | null;
  index?: number;
  attachments?: Attachment[];
  variant?: ChatBubbleVariant;
  /**
   * `messageId` + `(messageId, content) => void` rather than a pre-bound
   * `() => void`: a pre-bound closure would be reallocated by the parent on
   * every render (most notably on every keystroke in the chat composer),
   * defeating `React.memo`. Callers should pass the stable `playMessage`
   * callback from `useChatTTS` directly.
   */
  messageId?: string;
  onPlayAudio?: (messageId: string, content: string) => void;
  onStopAudio?: () => void;
  audioState?: 'idle' | 'generating' | 'playing';
  audioElement?: HTMLAudioElement | null;
  onAssistantAvatarStartCall?: () => void;
  isAssistantAvatarStartCallDisabled?: boolean;
  assistantAvatarStartCallTooltip?: string;
}

function ChatMessageBubbleImpl({
  message,
  isUser,
  assistantPhoto,
  assistantName,
  isCoordinator = false,
  isLoading,
  timestamp,
  timezone,
  index,
  attachments,
  variant = 'profile',
  messageId,
  onPlayAudio,
  onStopAudio,
  audioState = 'idle',
  audioElement,
  onAssistantAvatarStartCall,
  isAssistantAvatarStartCallDisabled,
  assistantAvatarStartCallTooltip,
}: ChatMessageBubbleProps) {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';

  const timeString = timestamp ? formatMessageTime(timestamp, timezone) : null;
  const isProfile = variant === 'profile';
  const isTypingIndicator = !isUser && isLoading && !message;
  const assistantAvatarClassName = 'h-7 w-7 flex-shrink-0';
  const creatureAppearance = assistantPhoto ? parseCreatureSentinel(assistantPhoto) : null;
  const isDroidAudioPlaying = Boolean(
    creatureAppearance && audioState === 'playing' && audioElement
  );
  const droidLipsyncFrame = useDroidAudioElementLipsync(audioElement ?? null, {
    enabled: isDroidAudioPlaying,
  });

  // Copy lives on the message header row so it sits next to the audio
  // affordance with matching geometry. Disabled while the bubble is
  // still streaming (`isLoading && !message`) — there's nothing to
  // copy yet, and a flashing button on a typing indicator is noisy.
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: message,
    copyMessage: 'Message copied',
  });
  const canCopy = !isUser && !!message && !isTypingIndicator;

  const assistantAvatar = isCoordinator ? (
    <CoordinatorLogoAvatar className={assistantAvatarClassName} logoClassName="h-7 w-7" />
  ) : creatureAppearance ? (
    <span
      className={cn(assistantAvatarClassName, 'relative flex items-center justify-center')}
      data-speaking={isDroidAudioPlaying || undefined}
    >
      <CreatureAvatar
        appearance={assistantPhoto as string}
        className="h-full w-full rounded-full border"
        label={assistantName}
      />
      <AnimatePresence>
        {isDroidAudioPlaying && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-28 w-28 items-center justify-center overflow-visible drop-shadow-lg"
            initial={{ opacity: 0, scale: 0.25, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.25, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.75 }}
          >
            <DroidCallAvatar
              isSpeaking={droidLipsyncFrame.isActive}
              mouthShape={droidLipsyncFrame.mouthShape}
              speechLevel={droidLipsyncFrame.speechLevel}
              antenna={creatureAppearance.antenna}
              body={creatureAppearance.body}
              color={creatureAppearance.color}
              baseEyes={creatureAppearance.eyes}
              outfit={creatureAppearance.outfit}
              label={assistantName}
              className="h-full w-full"
              creatureClassName="h-full w-full"
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  ) : (
    <Avatar className={cn(assistantAvatarClassName, 'border')}>
      <AvatarImage src={assistantPhoto ?? undefined} alt={assistantName} />
      <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
    </Avatar>
  );

  const assistantAvatarNode = onAssistantAvatarStartCall ? (
    <AssistantStartCallButton
      onStartCall={onAssistantAvatarStartCall}
      disabled={isAssistantAvatarStartCallDisabled}
      tooltip={assistantAvatarStartCallTooltip}
      tooltipSide="right"
      testId="chat-avatar-start-call"
    >
      {assistantAvatar}
    </AssistantStartCallButton>
  ) : (
    assistantAvatar
  );

  const bubbleContent = () => {
    if (isTypingIndicator) {
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
            isProfile ? 'max-w-[85%] md:max-w-[66.6667%]' : 'max-w-[85%]'
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
      className={cn('min-w-0', isProfile && 'md:max-w-[66.6667%]')}
    >
      <div className="mb-2.5 flex items-center gap-2">
        {assistantAvatarNode}
        <span className="text-body-muted font-medium">{assistantName}</span>
        {timeString && (
          <time className="text-[10px] leading-none text-muted-foreground">{timeString}</time>
        )}
        {onPlayAudio && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={
                    audioState === 'playing'
                      ? onStopAudio
                      : () => onPlayAudio(messageId ?? '', message)
                  }
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
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>
                  {audioState === 'generating'
                    ? 'Generating audio'
                    : audioState === 'playing'
                      ? 'Stop audio'
                      : 'Play audio'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {canCopy && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={isCopied ? 'Message copied' : 'Copy message'}
                  data-testid="message-copy-button"
                  data-copied={isCopied || undefined}
                  className={cn(
                    'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded pt-0.5 transition-colors',
                    isCopied
                      ? 'text-primary'
                      : 'text-muted-foreground/50 hover:text-muted-foreground'
                  )}
                >
                  {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isCopied ? 'Message copied' : 'Copy message'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {attachments && attachments.length > 0 && (
        <MessageAttachmentList attachments={attachments} isAssistant />
      )}
      <div className="min-w-0 break-words font-sans text-sm leading-relaxed">{bubbleContent()}</div>
    </div>
  );
}

/**
 * Memoised so each bubble is skipped when the surrounding chat panel
 * re-renders for unrelated reasons (e.g. a keystroke in the composer
 * textarea). Default shallow-equality is sufficient because:
 *  - All scalar props (`message`, `isUser`, `assistantName`, `timezone`,
 *    `index`, `variant`, `audioState`, `messageId`, `assistantPhoto`,
 *    `isLoading`) are primitives.
 *  - `timestamp` and `attachments` are owned by the immutable message
 *    object stored in chat history, so their references are stable for as
 *    long as the message itself is unchanged.
 *  - `onPlayAudio` / `onStopAudio` are passed straight through from
 *    `useChatTTS` (memoised) and only change when audio playback state
 *    transitions, which is intentional and rare.
 */
export const ChatMessageBubble = React.memo(ChatMessageBubbleImpl);
