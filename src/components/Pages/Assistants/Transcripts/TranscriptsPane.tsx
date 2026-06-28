'use client';

import * as React from 'react';
import {
  Check,
  Copy,
  Hash,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Smartphone,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { ChatMarkdown } from '@/components/Chat/ChatMarkdown';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { TabToolbar } from '../Common/TabToolbar';
import { TabFooter } from '../Common/TabFooter';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContactRow, TranscriptRow } from '@/types/assistants/brain';

interface TranscriptsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

interface ChannelDef {
  id: string;
  label: string;
  Icon: React.ElementType;
  /** Orchestra `medium` values mapped onto this channel. */
  mediums: string[];
  /** Brand accent token used as the per-channel highlight color. */
  cssVar: string;
}

const CHANNELS: ChannelDef[] = [
  {
    id: 'chat',
    label: 'Chat',
    Icon: MessageSquare,
    mediums: ['unify_message'],
    cssVar: 'var(--role-green)',
  },
  { id: 'email', label: 'Email', Icon: Mail, mediums: ['email'], cssVar: 'var(--role-cyan)' },
  { id: 'call', label: 'Call', Icon: Phone, mediums: ['unify_meet'], cssVar: 'var(--role-purple)' },
  { id: 'sms', label: 'SMS', Icon: Smartphone, mediums: ['sms'], cssVar: 'var(--role-orange)' },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Icon: MessageCircle,
    mediums: ['whatsapp'],
    cssVar: 'var(--role-teal)',
  },
  {
    id: 'discord',
    label: 'Discord',
    Icon: Hash,
    mediums: ['discord'],
    cssVar: 'var(--role-purple)',
  },
];

/** Deterministic avatar tints drawn from the brand role palette. */
const AVATAR_TONES = [
  'var(--role-green)',
  'var(--role-cyan)',
  'var(--role-purple)',
  'var(--role-orange)',
  'var(--role-teal)',
  'var(--role-pink)',
  'var(--role-blue)',
];

function channelForMedium(medium: string | null): ChannelDef | null {
  if (!medium) return null;
  return CHANNELS.find((channel) => channel.mediums.includes(medium)) ?? null;
}

function toneFor(id: number): string {
  return AVATAR_TONES[((id % AVATAR_TONES.length) + AVATAR_TONES.length) % AVATAR_TONES.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Pull a thread subject from the first message: the `Subject:` line of an
 *  email, otherwise a trimmed snippet of the opening message. */
function deriveSubject(messages: TranscriptRow[]): string {
  const first = messages[0]?.content ?? '';
  const subjectMatch = first.match(/^\s*Subject:\s*(.+)$/im);
  if (subjectMatch) return subjectMatch[1].trim();
  const callMatch = first.match(/^\s*Call:\s*(.+?)(?:\s—|\.|$)/im);
  if (callMatch) return callMatch[1].trim();
  const snippet = first.replace(/\s+/g, ' ').trim();
  return snippet.length > 64 ? `${snippet.slice(0, 64)}…` : snippet || 'Conversation';
}

/** Strip a leading `Subject:` block so the reader body shows the message, not
 *  the subject we already render in the header. */
function messageBody(content: string | null): string {
  if (!content) return '';
  return content.replace(/^\s*Subject:\s*.+\n+/i, '').trim();
}

function formatTime(ts: string | null): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDay(ts: string | null): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function fetchRows<T>(context: string): Promise<T[]> {
  const params = new URLSearchParams({ projectName: 'Assistants', context, limit: '200' });
  try {
    const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.logs ?? []).map((log: { entries?: T }) => log.entries ?? ({} as T));
  } catch {
    return [];
  }
}

export function TranscriptsPane({ assistant, ownerId, assistantId }: TranscriptsPaneProps) {
  const [channel, setChannel] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [transcripts, setTranscripts] = React.useState<TranscriptRow[]>([]);
  const [contacts, setContacts] = React.useState<ContactRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [openExchangeId, setOpenExchangeId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    const [transcriptRows, contactRows] = await Promise.all([
      fetchRows<TranscriptRow>(`${ownerId}/${assistantId}/Transcripts`),
      fetchRows<ContactRow>(`${ownerId}/${assistantId}/Contacts`),
    ]);
    setTranscripts(transcriptRows);
    setContacts(contactRows);
  }, [ownerId, assistantId]);

  React.useEffect(() => {
    setIsLoading(true);
    void load().finally(() => setIsLoading(false));
  }, [load]);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const nameFor = React.useCallback(
    (contactId: number | null): string => {
      if (contactId === null) return 'Unknown';
      const contact = contacts.find((c) => c.contactId === contactId);
      if (contact)
        return [contact.firstName, contact.surname].filter(Boolean).join(' ') || 'Unknown';
      if (contactId === assistant.selfContactId) {
        return [assistant.firstName, assistant.surname].filter(Boolean).join(' ') || 'Assistant';
      }
      return `#${contactId}`;
    },
    [contacts, assistant]
  );

  const channelCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: transcripts.length };
    for (const channelDef of CHANNELS) counts[channelDef.id] = 0;
    for (const row of transcripts) {
      const channelDef = channelForMedium(row.medium);
      if (channelDef) counts[channelDef.id] += 1;
    }
    return counts;
  }, [transcripts]);

  const filtered = React.useMemo(() => {
    if (channel === 'all') return transcripts;
    return transcripts.filter((row) => channelForMedium(row.medium)?.id === channel);
  }, [transcripts, channel]);

  const sortedAsc = React.useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime()
      ),
    [filtered]
  );

  const threads = React.useMemo(() => {
    const byExchange = new Map<number, TranscriptRow[]>();
    for (const row of sortedAsc) {
      const key = row.exchangeId ?? row.messageId;
      if (!byExchange.has(key)) byExchange.set(key, []);
      byExchange.get(key)!.push(row);
    }
    const built = Array.from(byExchange.entries()).map(([exchangeId, messages]) => {
      const last = messages[messages.length - 1];
      const participants = new Set<number>();
      messages.forEach((m) => {
        if (m.senderId !== null) participants.add(m.senderId);
        (m.receiverIds ?? []).forEach((id) => participants.add(id));
      });
      return {
        exchangeId,
        messages,
        last,
        channel: channelForMedium(last.medium),
        subject: deriveSubject(messages),
        participantIds: Array.from(participants),
      };
    });
    built.sort(
      (a, b) =>
        new Date(b.last.timestamp ?? 0).getTime() - new Date(a.last.timestamp ?? 0).getTime()
    );
    if (!search.trim()) return built;
    const needle = search.trim().toLowerCase();
    return built.filter((thread) => {
      if (thread.subject.toLowerCase().includes(needle)) return true;
      if (thread.participantIds.some((id) => nameFor(id).toLowerCase().includes(needle)))
        return true;
      return thread.messages.some((m) => (m.content ?? '').toLowerCase().includes(needle));
    });
  }, [sortedAsc, search, nameFor]);

  // Keep a valid selection as filters/search change.
  React.useEffect(() => {
    if (threads.length === 0) {
      if (openExchangeId !== null) setOpenExchangeId(null);
      return;
    }
    if (!threads.some((t) => t.exchangeId === openExchangeId)) {
      setOpenExchangeId(threads[0].exchangeId);
    }
  }, [threads, openExchangeId]);

  const activeThread = threads.find((t) => t.exchangeId === openExchangeId) ?? threads[0] ?? null;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      data-testid="transcripts-pane"
    >
      {/* Toolbar: channel segments + search + refresh */}
      <TabToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search across all channels…"
        searchTestId="transcripts-search"
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh transcripts"
        leading={
          <div
            className="inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-muted p-[3px]"
            data-testid="transcripts-channel-seg"
          >
            <SegButton
              label="All"
              active={channel === 'all'}
              onClick={() => setChannel('all')}
              count={channelCounts.all}
            />
            {CHANNELS.map((channelDef) => {
              const active = channel === channelDef.id;
              const ChannelIcon = channelDef.Icon;
              return (
                <button
                  key={channelDef.id}
                  type="button"
                  onClick={() => setChannel(channelDef.id)}
                  title={`${channelDef.label}${channelCounts[channelDef.id] ? ` · ${channelCounts[channelDef.id]}` : ''}`}
                  data-testid={`transcripts-channel-${channelDef.id}`}
                  aria-pressed={active}
                  style={active ? { color: channelDef.cssVar } : undefined}
                  className={cn(
                    'text-caption inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 transition-colors',
                    active ? 'bg-accent-soft' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <ChannelIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        }
      />

      {/* Threads split: list + reader */}
      {isLoading ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : threads.length === 0 ? (
        <p className="text-body-muted p-8 text-center">No conversations yet.</p>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Thread list */}
          <div
            className="flex w-[320px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-3"
            data-testid="transcripts-threads"
          >
            {threads.map((thread) => {
              const channelDef = thread.channel;
              const Icon = channelDef?.Icon ?? MessageSquare;
              const ch = channelDef?.cssVar ?? 'var(--muted-ink)';
              const active = activeThread?.exchangeId === thread.exchangeId;
              return (
                <button
                  key={thread.exchangeId}
                  type="button"
                  onClick={() => setOpenExchangeId(thread.exchangeId)}
                  data-testid={`transcripts-thread-${thread.exchangeId}`}
                  style={
                    {
                      '--ch': ch,
                      ...(active
                        ? { backgroundColor: 'color-mix(in srgb, var(--ch) 12%, transparent)' }
                        : {}),
                    } as React.CSSProperties
                  }
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors',
                    !active && 'hover:bg-muted'
                  )}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
                    style={{
                      color: ch,
                      backgroundColor: 'color-mix(in srgb, var(--ch) 16%, var(--surface))',
                    }}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-title truncate">{thread.subject}</div>
                    <div className="text-caption mt-0.5 truncate">
                      <span style={{ color: ch }}>{channelDef?.label ?? 'Other'}</span> ·{' '}
                      {thread.messages.length} msg · {thread.participantIds.length} people
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                    {formatDay(thread.last.timestamp)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Exchange reader */}
          {activeThread && (
            <div
              className="flex min-w-0 flex-1 flex-col overflow-y-auto"
              data-testid="transcripts-reader"
              style={
                {
                  '--ch': activeThread.channel?.cssVar ?? 'var(--muted-ink)',
                } as React.CSSProperties
              }
            >
              <div className="sticky top-0 z-[1] border-b border-border bg-background px-6 py-4">
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]"
                    style={{
                      color: 'var(--ch)',
                      backgroundColor: 'color-mix(in srgb, var(--ch) 16%, var(--surface))',
                    }}
                  >
                    {React.createElement(activeThread.channel?.Icon ?? MessageSquare, {
                      className: 'h-[18px] w-[18px]',
                      'aria-hidden': true,
                    })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-h2 truncate">{activeThread.subject}</div>
                    <div className="text-caption mt-0.5">
                      {activeThread.channel?.label ?? 'Other'} · exchange #{activeThread.exchangeId}{' '}
                      · {activeThread.messages.length} messages
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                    <Users className="h-3 w-3" aria-hidden="true" /> Participants
                  </span>
                  {activeThread.participantIds.map((id) => (
                    <span
                      key={id}
                      className="text-caption inline-flex items-center gap-1.5 rounded-full border border-border bg-card-2 py-[3px] pl-[3px] pr-2.5 text-foreground"
                    >
                      <span
                        className="grid h-5 w-5 place-items-center rounded-full font-display text-[9px] font-semibold text-primary-foreground"
                        style={{ backgroundColor: toneFor(id) }}
                      >
                        {initialsFor(nameFor(id))}
                      </span>
                      {nameFor(id)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3.5 px-6 py-5">
                {activeThread.messages.map((message) => {
                  const out =
                    message.senderId !== null && message.senderId === assistant.selfContactId;
                  const senderName = out
                    ? assistant.firstName || 'Assistant'
                    : nameFor(message.senderId);
                  const receivers = message.receiverIds ?? [];
                  return (
                    <TranscriptMessageRow
                      key={message.messageId}
                      out={out}
                      senderName={senderName}
                      senderTone={out ? 'var(--primary)' : toneFor(message.senderId ?? 0)}
                      receiverSummary={
                        receivers.length > 0
                          ? `to ${receivers.map((id) => nameFor(id)).join(', ')}`
                          : null
                      }
                      timeLabel={formatTime(message.timestamp)}
                      body={messageBody(message.content)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <TabFooter
        testId="transcripts-footer"
        right={
          <span className="text-caption">
            {threads.length} {threads.length === 1 ? 'exchange' : 'exchanges'} ·{' '}
            {threads.reduce((sum, t) => sum + t.messages.length, 0)} messages
          </span>
        }
      />
    </div>
  );
}

function TranscriptMessageRow({
  out,
  senderName,
  senderTone,
  receiverSummary,
  timeLabel,
  body,
}: {
  out: boolean;
  senderName: string;
  senderTone: string;
  receiverSummary: string | null;
  timeLabel: string;
  body: string;
}) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: body,
    copyMessage: 'Message copied',
    showSuccessNotification: false,
  });

  return (
    <div className="group flex w-full gap-3">
      <span
        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] font-display text-[11px] font-semibold text-primary-foreground"
        style={{ backgroundColor: senderTone }}
      >
        {initialsFor(senderName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <b className="text-[12px] font-semibold text-foreground">{senderName}</b>
          {receiverSummary && (
            <span className="text-[11px] text-muted-foreground">{receiverSummary}</span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">{timeLabel}</span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={isCopied ? 'Message copied' : 'Copy message'}
            data-testid="transcript-copy-button"
            className={cn(
              'ml-auto flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100',
              isCopied
                ? 'text-primary opacity-100'
                : 'text-muted-foreground/60 hover:text-foreground'
            )}
          >
            {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        {/* Assistant ("out") replies render as plain no-bubble markdown to match
            Chat; inbound human messages keep a subtle bubble. */}
        {out ? (
          <div className="text-[13px] leading-relaxed text-foreground">
            <ChatMarkdown content={body} />
          </div>
        ) : (
          <div className="min-w-0 rounded-[13px] border border-border bg-card-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
            <ChatMarkdown content={body} />
          </div>
        )}
      </div>
    </div>
  );
}

function SegButton({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'text-caption inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 transition-colors',
        active
          ? 'bg-accent-soft text-accent-soft-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {count ? <span className="font-mono text-[10px] opacity-70">{count}</span> : null}
    </button>
  );
}
