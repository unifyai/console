import * as React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Textarea } from '@/components/UI/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { ChatMention } from '@/types/orgChat';

export interface OrgChatPanelMessage {
  id: string;
  senderName: string;
  senderKind: 'user' | 'assistant';
  isSelf: boolean;
  content: string;
  timestamp: string | null;
  avatarUrl?: string | null;
}

export interface OrgChatPanelProps {
  title: string;
  subtitle?: string;
  messages: OrgChatPanelMessage[];
  isLoading: boolean;
  onSend: (content: string, mentions: ChatMention[]) => Promise<boolean> | boolean;
  /** Candidates for `@` mention autocomplete (team chat only). */
  mentionCandidates?: ChatMention[];
  placeholder?: string;
  emptyState?: string;
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

/**
 * Finds an in-progress `@mention` immediately before the caret. Returns the
 * index of the `@` and the partial query typed so far, or null when the
 * caret is not inside a mention.
 */
function findActiveMention(value: string, caret: number): { at: number; query: string } | null {
  const upToCaret = value.slice(0, caret);
  const match = /@([^\s@]*)$/.exec(upToCaret);
  if (!match) return null;
  return { at: match.index, query: match[1] ?? '' };
}

/**
 * Shared presentational chat panel for team group chat and human DMs:
 * grouped message list with auto-scroll, and a composer with optional
 * `@mention` autocomplete.
 */
export function OrgChatPanel({
  title,
  subtitle,
  messages,
  isLoading,
  onSend,
  mentionCandidates,
  placeholder = 'Write a message…',
  emptyState = 'No messages yet.',
}: OrgChatPanelProps) {
  const [input, setInput] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [recordedMentions, setRecordedMentions] = React.useState<ChatMention[]>([]);
  const [mentionQuery, setMentionQuery] = React.useState<{ at: number; query: string } | null>(
    null
  );
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

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
    setRecordedMentions((prev) =>
      prev.some((m) => m.kind === candidate.kind && m.id === candidate.id)
        ? prev
        : [...prev, candidate]
    );
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isSending) return;
    // Only mentions whose `@Name` text survived edits count.
    const mentions = recordedMentions.filter((m) => content.includes(`@${m.name ?? m.id}`));
    setIsSending(true);
    setInput('');
    setRecordedMentions([]);
    setMentionQuery(null);
    try {
      await onSend(content, mentions);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="org-chat-panel">
      <div className="border-b px-4 py-3">
        <div className="text-title">{title}</div>
        {subtitle && <div className="text-caption">{subtitle}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-body-muted flex h-full items-center justify-center">
            {emptyState}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const isGroupStart =
                !previous ||
                previous.senderName !== message.senderName ||
                previous.isSelf !== message.isSelf;
              const timeString = formatTime(message.timestamp);

              if (message.isSelf) {
                return (
                  <div key={message.id} className={cn('flex justify-end', isGroupStart && 'mt-3')}>
                    <div className="max-w-[85%] break-words rounded-lg bg-accent p-2.5 font-sans text-sm leading-snug">
                      <span className="whitespace-pre-wrap">{message.content}</span>
                      {timeString && (
                        <time className="mt-1 block text-right text-[10px] leading-none text-muted-foreground">
                          {timeString}
                        </time>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className={cn('min-w-0', isGroupStart && 'mt-3')}>
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
                    </div>
                  )}
                  <div className="max-w-[85%] break-words rounded-lg bg-muted p-2.5 font-sans text-sm leading-snug">
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  </div>
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
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            data-testid="org-chat-composer"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="max-h-32 min-h-[38px] flex-1 resize-none"
          />
          <Button
            data-testid="org-chat-send"
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
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
  );
}
