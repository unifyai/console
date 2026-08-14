'use client';

import * as React from 'react';
import {
  Send,
  Loader2,
  Paperclip,
  Mic,
  Square,
  Camera,
  File,
  Search,
  Phone,
  Copy,
  Check,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Textarea } from '@/components/UI/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { ChatMention, OrgChatAttachment, OrgChatReaction } from '@/types/orgChat';
import { resolveMentionsInText } from '@/utils/assistants/chat-mentions';
import type { Attachment, CallPill, MessageReaction } from '@/types/assistants/chat';
import { CallPillBubble } from '@/components/Chat/CallPill';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useVoiceRecorder } from '@/hooks/Assistants/useVoiceRecorder';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { PendingAttachmentList } from '@/components/Chat/ChatAttachments';
import { CameraCapture } from '@/components/Chat/CameraCapture';
import { EmojiReactionPicker } from '@/components/Chat/EmojiReactionPicker';
import { MessageReactionsBar } from '@/components/Chat/MessageReactionsBar';
import {
  createAttachment,
  isOversized,
  uploadOrgAttachment,
  validateFileType,
} from '@/components/Chat/attachmentUtils';
import { tabToolbarIconButtonClass } from '@/components/Pages/Assistants/Common/TabToolbar';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { isImeComposing } from '@/utils/keyboard';

const messageActionButtonClass =
  'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors text-muted-foreground/50 hover:text-muted-foreground';
const messageActionIconClass = 'h-3.5 w-3.5';

export interface OrgChatPanelMessage {
  id: string;
  senderName: string;
  senderKind: 'user' | 'assistant';
  isSelf: boolean;
  content: string;
  timestamp: string | null;
  avatarUrl?: string | null;
  attachments?: OrgChatAttachment[];
  reactions?: OrgChatReaction[];
}

type TimelineEntry =
  | { kind: 'message'; ts: number; message: OrgChatPanelMessage }
  | { kind: 'pill'; ts: number; pill: CallPill };

export interface OrgChatPanelProps {
  title: string;
  subtitle?: string;
  messages: OrgChatPanelMessage[];
  /**
   * Session-derived, duration-only call markers merged into the timeline by
   * timestamp. Human-to-human calls carry no transcript, so these pills are
   * static (non-interactive).
   */
  callPills?: CallPill[];
  isLoading: boolean;
  onSend: (
    content: string,
    mentions: ChatMention[],
    attachments: OrgChatAttachment[]
  ) => Promise<boolean> | boolean;
  /** Candidates for `@` mention autocomplete (team chat only). */
  mentionCandidates?: ChatMention[];
  placeholder?: string;
  emptyState?: string;
  /** Hide the inner title bar when the parent already shows identity. */
  hideHeader?: boolean;
  orgId?: string | null;
  onStartCall?: () => void;
  isCallButtonDisabled?: boolean;
  callButtonTooltip?: string;
  isConnectingCall?: boolean;
  onOpenSearch?: () => void;
  /** Scroll / highlight target after search jump. */
  highlightMessageId?: string | null;
  currentUserId?: string | null;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  canReact?: boolean;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}

function formatTime(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toMessageReactions(reactions: OrgChatReaction[] | undefined): MessageReaction[] {
  return (reactions ?? []).map((reaction) => ({
    userId: reaction.userId,
    emoji: reaction.emoji,
    ...(reaction.updatedAt ? { updatedAt: new Date(reaction.updatedAt) } : {}),
  }));
}

function OrgChatMessageActions({
  content,
  canReact,
  onToggleReaction,
}: {
  content: string;
  canReact: boolean;
  onToggleReaction?: (emoji: string) => void;
}) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage: 'Message copied',
    showSuccessNotification: false,
  });
  const canCopy = !!content;

  if (!canCopy && !(canReact && onToggleReaction)) return null;

  return (
    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
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
                className={cn(messageActionButtonClass, isCopied && 'text-primary')}
              >
                {isCopied ? (
                  <Check className={messageActionIconClass} />
                ) : (
                  <Copy className={messageActionIconClass} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isCopied ? 'Message copied' : 'Copy message'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {canReact && onToggleReaction ? (
        <EmojiReactionPicker
          onSelect={onToggleReaction}
          className={cn(
            messageActionButtonClass,
            'inline-flex hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50'
          )}
          iconClassName={messageActionIconClass}
        />
      ) : null}
    </div>
  );
}

function findActiveMention(value: string, caret: number): { at: number; query: string } | null {
  const upToCaret = value.slice(0, caret);
  const match = /@([^\s@]*)$/.exec(upToCaret);
  if (!match) return null;
  return { at: match.index, query: match[1] ?? '' };
}

/**
 * Shared chat panel for team group chat and human DMs — chrome matches
 * assistant chat (search + call toolbar, paperclip/mic composer).
 */
export function OrgChatPanel({
  title,
  subtitle,
  messages,
  callPills,
  isLoading,
  onSend,
  mentionCandidates,
  placeholder = 'Send a message...',
  emptyState = 'No messages yet.',
  hideHeader = false,
  orgId = null,
  onStartCall,
  isCallButtonDisabled = true,
  callButtonTooltip = 'Voice calls are not available',
  isConnectingCall = false,
  onOpenSearch,
  highlightMessageId = null,
  currentUserId = null,
  onToggleReaction,
  canReact = false,
}: OrgChatPanelProps) {
  const { transcription: transcriptionEnabled, voiceCalls } = useFeatures();
  const [input, setInput] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<{ at: number; query: string } | null>(
    null
  );
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const [pendingAttachments, setPendingAttachments] = React.useState<Attachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const [attachError, setAttachError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const messageRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const insertTranscript = React.useCallback((text: string) => {
    setInput((prev) => {
      const next = prev.trim() ? `${prev.trim()} ${text}` : text;
      return next;
    });
  }, []);

  const { toggleRecording, recorderError, isRecording, isTranscribing } = useVoiceRecorder({
    onTranscript: insertTranscript,
  });

  // Merge messages and call pills into one chronological timeline. Messages are
  // already oldest-first; pills are slotted in by timestamp (a message with no
  // parseable timestamp inherits the previous entry's, preserving send order).
  const timeline = React.useMemo<TimelineEntry[]>(() => {
    let lastTs = 0;
    const messageEntries: TimelineEntry[] = messages.map((message) => {
      const parsed = message.timestamp ? new Date(message.timestamp).getTime() : NaN;
      const ts = Number.isNaN(parsed) ? lastTs : parsed;
      lastTs = ts;
      return { kind: 'message', ts, message };
    });
    const pillEntries: TimelineEntry[] = (callPills ?? []).map((pill) => ({
      kind: 'pill',
      ts: pill.timestamp.getTime(),
      pill,
    }));
    return [...messageEntries, ...pillEntries].sort((a, b) => a.ts - b.ts);
  }, [messages, callPills]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [timeline.length]);

  React.useEffect(() => {
    if (!highlightMessageId) return;
    const el = messageRefs.current[highlightMessageId];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightMessageId]);

  const filteredCandidates = React.useMemo(() => {
    if (!mentionQuery || !mentionCandidates?.length) return [];
    const query = mentionQuery.query.toLowerCase();
    return mentionCandidates.filter((c) => (c.name ?? '').toLowerCase().includes(query));
  }, [mentionQuery, mentionCandidates]);

  const updateMentionState = (value: string, caret: number) => {
    if (!mentionCandidates?.length) return;
    const active = findActiveMention(value, caret);
    setMentionQuery(active);
    setMentionIndex(0);
  };

  const selectMention = (candidate: ChatMention) => {
    if (!mentionQuery) return;
    const name = candidate.name ?? candidate.id;
    const caret = textareaRef.current?.selectionStart ?? input.length;
    const nextValue = `${input.slice(0, mentionQuery.at)}@${name} ${input.slice(caret)}`;
    setInput(nextValue);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const handleFiles = React.useCallback((files: File[]) => {
    setAttachError(null);
    const next: Attachment[] = [];
    for (const file of files) {
      const check = validateFileType(file.name);
      if (!check.valid) {
        setAttachError(check.error ?? 'Unsupported file type');
        continue;
      }
      next.push(createAttachment(file));
    }
    if (next.length) {
      setPendingAttachments((prev) => [...prev, ...next]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleFiles,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  const handleCameraCapture = React.useCallback((file: File) => {
    setPendingAttachments((prev) => [...prev, createAttachment(file)]);
    setIsCameraOpen(false);
  }, []);

  const removeAttachment = React.useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSend = async () => {
    const content = input.trim();
    const uploadable = pendingAttachments.filter((a) => !isOversized(a.sizeBytes));
    if ((!content && uploadable.length === 0) || isSending) return;

    // Read from the submitted text, not from what the picker happened to
    // record: a hand-typed "@Ada" addresses Ada just as much as a picked one.
    const mentions = resolveMentionsInText(content, mentionCandidates);
    setIsSending(true);
    setInput('');
    setMentionQuery(null);
    setAttachError(null);

    try {
      const uploaded: OrgChatAttachment[] = [];
      if (uploadable.length > 0) {
        if (!orgId) {
          setAttachError('Could not upload attachments. Please try again.');
          setIsSending(false);
          setPendingAttachments(uploadable);
          setInput(content);
          return;
        }
        for (const attachment of uploadable) {
          if (!attachment.file) continue;
          setPendingAttachments((prev) =>
            prev.map((a) => (a.id === attachment.id ? { ...a, uploadStatus: 'uploading' } : a))
          );
          const result = await uploadOrgAttachment(attachment.file, orgId);
          uploaded.push({
            id: result.id,
            filename: result.filename,
            gsUrl: result.gsUrl,
            contentType: result.contentType,
            sizeBytes: result.sizeBytes,
            signedUrl: result.signedUrl,
          });
        }
      }
      setPendingAttachments([]);
      await onSend(content, mentions, uploaded);
    } catch {
      setAttachError('Could not send message. Please try again.');
      setPendingAttachments(uploadable);
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // While an IME is composing, Enter/Tab/arrows/Escape belong to the
    // conversion candidate list, not to sending or to the mention popup.
    if (isImeComposing(e)) return;
    if (mentionQuery && filteredCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(
          (prev) => (prev - 1 + filteredCandidates.length) % filteredCandidates.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(filteredCandidates[mentionIndex] ?? filteredCandidates[0]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const callDisabled = isCallButtonDisabled || !voiceCalls || !onStartCall;
  const callTooltip = !voiceCalls ? 'Voice calls are not configured' : callButtonTooltip;

  const renderAttachments = (attachments: OrgChatAttachment[] | undefined) => {
    if (!attachments?.length) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={attachment.signedUrl || undefined}
            target="_blank"
            rel="noreferrer"
            className="bg-background/60 rounded border border-border px-1.5 py-0.5 text-[11px] text-foreground hover:underline"
            data-testid={`org-chat-attachment-${attachment.id}`}
          >
            {attachment.filename}
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="org-chat-panel">
      {!hideHeader ? (
        <div className="border-b px-4 py-3">
          <div className="text-title">{title}</div>
          {subtitle && <div className="text-caption">{subtitle}</div>}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            readOnly
            className="h-7 w-full cursor-text rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={tabSearchPlaceholder('chat')}
            onFocus={(e) => {
              e.currentTarget.blur();
              onOpenSearch?.();
            }}
            onClick={() => onOpenSearch?.()}
            data-testid="org-chat-search"
            aria-label="Search conversation"
          />
        </div>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={tabToolbarIconButtonClass}
                  onClick={onStartCall}
                  disabled={callDisabled}
                  data-testid="org-chat-call-button"
                >
                  {isConnectingCall ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{callTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="text-body-muted flex h-full items-center justify-center">
            {emptyState}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {timeline.map((entry, index) => {
              if (entry.kind === 'pill') {
                // Human-to-human calls carry no transcript — render a static,
                // duration-only pill (no onClick).
                return <CallPillBubble key={entry.pill.id} pill={entry.pill} />;
              }
              const message = entry.message;
              const previousEntry = timeline[index - 1];
              const previous =
                previousEntry && previousEntry.kind === 'message' ? previousEntry.message : null;
              const isGroupStart =
                !previous ||
                previous.senderName !== message.senderName ||
                previous.isSelf !== message.isSelf;
              const timeString = formatTime(message.timestamp);
              const highlighted = highlightMessageId === message.id;

              if (message.isSelf) {
                return (
                  <div
                    key={message.id}
                    ref={(el) => {
                      messageRefs.current[message.id] = el;
                    }}
                    className={cn(
                      'flex flex-col items-end',
                      isGroupStart && 'mt-3',
                      highlighted && 'rounded-lg ring-2 ring-primary'
                    )}
                    data-testid={`org-chat-message-${message.id}`}
                  >
                    <div className="max-w-[85%] break-words rounded-lg bg-accent p-2.5 font-sans text-sm leading-snug">
                      {message.content ? (
                        <span className="whitespace-pre-wrap">{message.content}</span>
                      ) : null}
                      {renderAttachments(message.attachments)}
                      {timeString && (
                        <time className="mt-1 block text-right text-[10px] leading-none text-muted-foreground">
                          {timeString}
                        </time>
                      )}
                    </div>
                    <MessageReactionsBar
                      reactions={toMessageReactions(message.reactions)}
                      currentUserId={currentUserId}
                      className="justify-end"
                    />
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  ref={(el) => {
                    messageRefs.current[message.id] = el;
                  }}
                  className={cn(
                    'group min-w-0',
                    isGroupStart && 'mt-3',
                    highlighted && 'rounded-lg ring-2 ring-primary'
                  )}
                  data-testid={`org-chat-message-${message.id}`}
                >
                  {isGroupStart && (
                    <div className="mb-1 flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {message.avatarUrl && (
                          <AvatarImage src={message.avatarUrl} alt={message.senderName} />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {initials(message.senderName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-label">{message.senderName}</span>
                      {message.senderKind === 'assistant' && (
                        <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold uppercase leading-none text-muted-foreground">
                          AI
                        </span>
                      )}
                      {timeString && (
                        <time className="text-[10px] leading-none text-muted-foreground">
                          {timeString}
                        </time>
                      )}
                      <OrgChatMessageActions
                        content={message.content}
                        canReact={canReact}
                        onToggleReaction={
                          onToggleReaction
                            ? (emoji) => onToggleReaction(message.id, emoji)
                            : undefined
                        }
                      />
                    </div>
                  )}
                  {!isGroupStart && (
                    <div className="mb-0.5 flex h-5 items-center gap-2">
                      <OrgChatMessageActions
                        content={message.content}
                        canReact={canReact}
                        onToggleReaction={
                          onToggleReaction
                            ? (emoji) => onToggleReaction(message.id, emoji)
                            : undefined
                        }
                      />
                    </div>
                  )}
                  <div className="max-w-[85%] break-words rounded-lg bg-muted p-2.5 font-sans text-sm leading-snug">
                    {message.content ? (
                      <span className="whitespace-pre-wrap">{message.content}</span>
                    ) : null}
                    {renderAttachments(message.attachments)}
                  </div>
                  <MessageReactionsBar
                    reactions={toMessageReactions(message.reactions)}
                    currentUserId={currentUserId}
                    onToggleReaction={
                      canReact && onToggleReaction
                        ? (emoji) => onToggleReaction(message.id, emoji)
                        : undefined
                    }
                  />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="relative border-t px-4 py-3">
        {mentionQuery && filteredCandidates.length > 0 && (
          <div className="absolute bottom-full left-4 z-10 mb-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {filteredCandidates.map((candidate, index) => (
              <button
                key={`${candidate.kind}:${candidate.id}`}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                  index === mentionIndex ? 'bg-accent' : 'hover:bg-accent'
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(candidate);
                }}
              >
                <span className="truncate">{candidate.name ?? candidate.id}</span>
                {candidate.kind === 'assistant' && (
                  <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold uppercase leading-none text-muted-foreground">
                    AI
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {(attachError || recorderError) && (
          <p className="text-caption text-error mb-2">{attachError || recorderError}</p>
        )}

        {pendingAttachments.length > 0 && (
          <PendingAttachmentList
            attachments={pendingAttachments}
            onRemove={removeAttachment}
            onRemoveAll={() => setPendingAttachments([])}
            className="mb-2"
          />
        )}

        <div
          {...getRootProps()}
          className={cn('relative', isDragActive && 'rounded-md ring-2 ring-primary ring-offset-2')}
          data-testid="org-chat-dropzone"
        >
          {isDragActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary-tint-10">
              <span className="font-medium text-primary">Drop files here</span>
            </div>
          )}
          <input {...getInputProps()} data-testid="org-chat-file-input" />

          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-2 left-2 h-8 w-8 rounded-full"
                  disabled={isSending || isRecording}
                  aria-label="Attach"
                  data-testid="org-chat-attach-button"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem
                  onClick={() => setIsCameraOpen(true)}
                  data-testid="org-chat-attach-webcam-item"
                >
                  <Camera className="h-4 w-4" />
                  Camera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={open} data-testid="org-chat-attach-files-item">
                  <File className="h-4 w-4" />
                  Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {transcriptionEnabled ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute bottom-2 left-10 h-8 w-8 rounded-full',
                  isRecording && 'animate-pulse text-[color:var(--status-danger)]'
                )}
                onClick={toggleRecording}
                disabled={isSending || isTranscribing}
                aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
                data-testid="org-chat-voice-record-button"
              >
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-3 w-3 fill-current" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            ) : null}

            <Textarea
              ref={textareaRef}
              data-testid="org-chat-composer"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                updateMentionState(
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length
                );
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording ? 'Recording...' : isTranscribing ? 'Transcribing...' : placeholder
              }
              rows={1}
              disabled={isSending}
              className={cn(
                'styled-scrollbar text-body h-12 min-h-12 resize-none overflow-y-hidden rounded-xl py-3.5 pr-12 leading-5',
                transcriptionEnabled ? 'pl-20' : 'pl-14'
              )}
            />

            <Button
              type="button"
              data-testid="org-chat-send"
              size="icon"
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
              onClick={() => void handleSend()}
              disabled={
                isSending || (!input.trim() && pendingAttachments.length === 0) || isRecording
              }
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <CameraCapture
        open={isCameraOpen}
        onOpenChange={setIsCameraOpen}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
