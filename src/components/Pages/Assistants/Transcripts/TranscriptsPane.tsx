'use client';

import * as React from 'react';
import {
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  Rows3,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContactRow, TranscriptRow } from '@/types/assistants/brain';

interface TranscriptsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

type ViewMode = 'threads' | 'feed' | 'table';

interface ChannelDef {
  id: string;
  label: string;
  Icon: React.ElementType;
  /** Orchestra `medium` values mapped onto this channel. */
  mediums: string[];
}

const CHANNELS: ChannelDef[] = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare, mediums: ['unify_message'] },
  { id: 'email', label: 'Email', Icon: Mail, mediums: ['email'] },
  { id: 'call', label: 'Call', Icon: Phone, mediums: ['unify_meet'] },
  { id: 'sms', label: 'SMS', Icon: Smartphone, mediums: ['sms'] },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, mediums: ['whatsapp'] },
];

function channelForMedium(medium: string | null): ChannelDef | null {
  if (!medium) return null;
  return CHANNELS.find((channel) => channel.mediums.includes(medium)) ?? null;
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
  const [view, setView] = React.useState<ViewMode>('threads');
  const [channel, setChannel] = React.useState<string>('all');
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
    const channelDef = CHANNELS.find((c) => c.id === channel);
    if (!channelDef) return transcripts;
    return transcripts.filter((row) => channelForMedium(row.medium)?.id === channelDef.id);
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
    return Array.from(byExchange.entries())
      .map(([exchangeId, messages]) => {
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
          participantNames: Array.from(participants).map(nameFor),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.last.timestamp ?? 0).getTime() - new Date(a.last.timestamp ?? 0).getTime()
      );
  }, [sortedAsc, nameFor]);

  const isAssistant = React.useCallback(
    (senderId: number | null) => senderId !== null && senderId === assistant.selfContactId,
    [assistant.selfContactId]
  );

  return (
    <div
      className="flex h-full w-full overflow-hidden bg-background"
      data-testid="transcripts-pane"
    >
      {/* Channel rail */}
      <div className="flex w-48 shrink-0 flex-col border-r border-border bg-card">
        <div className="text-label-muted border-b border-border px-3 py-2 uppercase tracking-wide">
          Channels
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="transcripts-channel-rail">
          <ChannelButton
            label="All"
            Icon={Rows3}
            count={channelCounts.all}
            active={channel === 'all'}
            onClick={() => setChannel('all')}
          />
          {CHANNELS.map((channelDef) => (
            <ChannelButton
              key={channelDef.id}
              label={channelDef.label}
              Icon={channelDef.Icon}
              count={channelCounts[channelDef.id] ?? 0}
              active={channel === channelDef.id}
              onClick={() => setChannel(channelDef.id)}
            />
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {(['threads', 'feed', 'table'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                data-active={view === mode}
                data-testid={`transcripts-view-${mode}`}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  view === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Refresh transcripts"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : sortedAsc.length === 0 ? (
            <p className="text-body-muted p-8 text-center">No conversations yet.</p>
          ) : view === 'threads' ? (
            <div className="divide-y divide-border" data-testid="transcripts-threads">
              {threads.map((thread) => {
                const Icon = thread.channel?.Icon ?? MessageSquare;
                const isOpen = openExchangeId === thread.exchangeId;
                return (
                  <div key={thread.exchangeId}>
                    <button
                      type="button"
                      onClick={() => setOpenExchangeId(isOpen ? null : thread.exchangeId)}
                      className="hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-title truncate text-foreground">
                            {thread.participantNames.join(', ') || 'Conversation'}
                          </span>
                          <span className="text-caption shrink-0">
                            {formatTime(thread.last.timestamp)}
                          </span>
                        </div>
                        <p className="text-body-muted mt-0.5 truncate">
                          {thread.last.content ?? ''}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-soft-foreground">
                          {thread.channel?.label ?? 'Other'} · {thread.messages.length}
                        </span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="bg-muted/30 space-y-2 px-4 py-3">
                        {thread.messages.map((message) => (
                          <MessageBubble
                            key={message.messageId}
                            message={message}
                            name={nameFor(message.senderId)}
                            isAssistant={isAssistant(message.senderId)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : view === 'feed' ? (
            <div className="space-y-2 p-4" data-testid="transcripts-feed">
              {sortedAsc.map((message) => (
                <MessageBubble
                  key={message.messageId}
                  message={message}
                  name={nameFor(message.senderId)}
                  isAssistant={isAssistant(message.senderId)}
                  showChannel
                />
              ))}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm" data-testid="transcripts-table">
              <thead className="sticky top-0 bg-card">
                <tr>
                  {['Channel', 'From', 'Content', 'Time'].map((col) => (
                    <th
                      key={col}
                      className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAsc
                  .slice()
                  .reverse()
                  .map((message) => (
                    <tr key={message.messageId} className="hover:bg-muted/50">
                      <td className="border-b border-border px-3 py-2 text-muted-foreground">
                        {channelForMedium(message.medium)?.label ?? 'Other'}
                      </td>
                      <td className="border-b border-border px-3 py-2 text-foreground">
                        {nameFor(message.senderId)}
                      </td>
                      <td className="max-w-[420px] truncate border-b border-border px-3 py-2 text-foreground">
                        {message.content ?? ''}
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-2 text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelButton({
  label,
  Icon,
  count,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ElementType;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count || ''}</span>
    </button>
  );
}

function MessageBubble({
  message,
  name,
  isAssistant,
  showChannel = false,
}: {
  message: TranscriptRow;
  name: string;
  isAssistant: boolean;
  showChannel?: boolean;
}) {
  return (
    <div className={cn('flex', isAssistant ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
          isAssistant
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-foreground'
        )}
      >
        <div
          className={cn(
            'mb-0.5 flex items-center gap-2 text-[11px]',
            isAssistant ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          <span className="font-medium">{name}</span>
          {showChannel && <span>· {channelForMedium(message.medium)?.label ?? 'Other'}</span>}
          <span>· {formatTime(message.timestamp)}</span>
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content ?? ''}</p>
      </div>
    </div>
  );
}
