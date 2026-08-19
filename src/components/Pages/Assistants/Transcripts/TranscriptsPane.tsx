'use client';

import * as React from 'react';
import { WhatsApp } from '@mui/icons-material';
import {
  Check,
  Copy,
  Mail,
  MessageSquare,
  Phone,
  Play,
  Slack,
  Smartphone,
  Users,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { TabSplitSkeleton } from '@/components/Common/Loaders/Skeletons';
import { ChatMarkdown } from '@/components/Chat/ChatMarkdown';
import { ScrollArea } from '@/components/UI/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import { useShellResource } from '@/hooks/Common/useShellResource';
import { groupByCalendarDay, TimelineDateSeparator } from '../Common/TimelineDateSeparator';
import { TabToolbar } from '../Common/TabToolbar';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { TabSegmentGroup, TabSegment } from '../Common/TabSegmentGroup';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { SplitPaneLayout } from '../Common/SplitPaneLayout';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import type { ContactRow, ExchangeRow, TranscriptRow } from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';
import {
  activeCueMessageId,
  formatClock,
  isCallExchange,
  isChatFrom,
  offsetFromRecordingStart,
  parseUtteranceOffset,
  recordingStartedAtFrom,
  recordingUrlFrom,
  speechStartedAtFrom,
  type UtteranceCue,
} from '@/utils/assistants/callRecording';
import {
  TranscriptRecordingPlayer,
  type TranscriptRecordingPlayerHandle,
} from './TranscriptRecordingPlayer';
import { brandAvatarToneFromId } from '@/utils/brand/avatarPalette';
import { ContactAvatar } from '../Common/ContactAvatar';
import { contactIsAssistantSelf } from '@/utils/assistants/contactAvatar';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { rootKey, roots, type ContextRoot } from '@/lib/assistants/scope';
import { usePendingTranscriptThreadTarget } from '@/lib/navigation/AppShellRouter';
import { fetchRowsAcrossRoots } from '@/lib/assistants/federatedRows';

type TranscriptViewMode = 'threads' | 'feed';

interface FlatMessage {
  message: ScopedTranscriptRow;
  threadSubject: string;
  channel: ChannelDef | null;
}

interface TranscriptsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/…` instead of the
   *  assistant's personal root. */
  root?: ContextRoot | null;
  enabled?: boolean;
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

/** Transcript row plus the scope root it was read from (merged "All" view). */
type ScopedTranscriptRow = TranscriptRow & { rootKey: string };

interface TranscriptsResourceData {
  transcriptRows: ScopedTranscriptRow[];
  /** Contacts per source root: contact ids are root-local, so sender names
   *  must resolve against the row's own root first. */
  contactsByRoot: Record<string, ContactRow[]>;
  /** Exchange metadata keyed by `{rootKey}:{exchangeId}`. Exchange ids are
   *  root-local, so the root has to be part of the key. */
  exchangeMetaByKey: Record<string, Record<string, unknown>>;
}

/** Namespaced exchange key, matching `threadKeyForRow`'s scoping. */
function exchangeKey(rootKeyValue: string, exchangeId: number | null): string | null {
  return exchangeId === null ? null : `${rootKeyValue}:${exchangeId}`;
}

function TranscriptsWhatsAppIcon({ className }: { className?: string }) {
  const fontSize = className?.includes('h-3.5') ? 14 : className?.includes('h-4') ? 16 : 18;
  return <WhatsApp className={className} sx={{ fontSize }} aria-hidden />;
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
  {
    id: 'call',
    label: 'Call',
    Icon: Phone,
    mediums: ['unify_meet', 'phone_call', 'whatsapp_call', 'google_meet', 'teams_meet'],
    cssVar: 'var(--role-purple)',
  },
  {
    id: 'sms',
    label: 'SMS',
    Icon: Smartphone,
    mediums: ['sms_message'],
    cssVar: 'var(--role-orange)',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Icon: TranscriptsWhatsAppIcon,
    mediums: ['whatsapp_message'],
    cssVar: 'var(--role-teal)',
  },
  {
    id: 'slack',
    label: 'Slack',
    Icon: Slack,
    mediums: ['slack_message', 'slack_channel_message'],
    cssVar: 'var(--role-blue)',
  },
  {
    id: 'discord',
    label: 'Discord',
    Icon: FaDiscord,
    mediums: ['discord_message', 'discord_channel_message'],
    cssVar: 'var(--role-purple)',
  },
];

function channelForMedium(medium: string | null): ChannelDef | null {
  if (!medium) return null;
  return CHANNELS.find((channel) => channel.mediums.includes(medium)) ?? null;
}

function toneFor(id: number): string {
  return brandAvatarToneFromId(id);
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

/** Thread key: chat messages share one ongoing thread; other mediums group by
 *  exchange. Namespaced by source root so merged views cannot collide. */
function threadKeyForRow(row: ScopedTranscriptRow): string {
  const local = row.medium === 'unify_message' ? 'thread:chat' : (row.exchangeId ?? row.messageId);
  return `${row.rootKey}:${local}`;
}

export function TranscriptsPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: TranscriptsPaneProps) {
  const [viewMode, setViewMode] = React.useState<TranscriptViewMode>('threads');
  const [channel, setChannel] = React.useState<string>('all');
  const {
    draft: searchDraft,
    setDraft: setSearchDraft,
    committed: searchQuery,
    submit: submitSearch,
    clear: clearSearch,
  } = useTabSearchCommit();
  const [openThreadId, setOpenThreadId] = React.useState<string | null>(null);
  const isStackedLayout = useMatchesBelow('shellCompact');

  const { pendingTranscriptThread, clearPendingTranscriptThread } =
    usePendingTranscriptThreadTarget();
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const scopeKey = scope.root ? rootKey(scope.root) : 'all';
  const scopeRootRef = React.useRef(scope.root);
  scopeRootRef.current = scope.root;
  const assistantRef = React.useRef(assistant);
  assistantRef.current = assistant;
  const load = React.useCallback(async (): Promise<TranscriptsResourceData> => {
    const scopedRoots = scopeRootRef.current ? [scopeRootRef.current] : roots(assistantRef.current);
    const [transcriptRows, contactRows, exchangeRows] = await Promise.all([
      fetchRowsAcrossRoots<TranscriptRow>({
        scopedRoots,
        ownerId,
        assistantId,
        table: 'Transcripts',
        limit: 200,
        sortField: 'timestamp',
      }),
      fetchRowsAcrossRoots<ContactRow>({
        scopedRoots,
        ownerId,
        assistantId,
        table: 'Contacts',
        limit: 1000,
      }),
      // Exchange-level extras the messages do not carry — a call's recording
      // URL lives here, attached asynchronously once egress finishes.
      fetchRowsAcrossRoots<ExchangeRow>({
        scopedRoots,
        ownerId,
        assistantId,
        table: 'Exchanges',
        limit: 200,
        sortField: 'exchange_id',
      }),
    ]);
    const contactsByRoot: Record<string, ContactRow[]> = {};
    for (const contact of contactRows) {
      (contactsByRoot[contact.rootKey] ??= []).push(contact);
    }
    const exchangeMetaByKey: Record<string, Record<string, unknown>> = {};
    for (const exchange of exchangeRows) {
      const key = exchangeKey(exchange.rootKey, exchange.exchangeId ?? null);
      if (key && exchange.metadata) exchangeMetaByKey[key] = exchange.metadata;
    }
    return { transcriptRows, contactsByRoot, exchangeMetaByKey };
  }, [ownerId, assistantId]);

  const {
    data: transcriptData,
    isInitialLoading,
    isRefreshing,
    refresh,
  } = useShellResource<TranscriptsResourceData>({
    queryKey: ['assistant-transcripts', ownerId, assistantId, scopeKey],
    queryFn: load,
    enabled: enabled && !!ownerId && !!assistantId,
  });

  const transcripts = React.useMemo(
    () => transcriptData?.transcriptRows ?? [],
    [transcriptData?.transcriptRows]
  );
  const contactsByRoot = React.useMemo(
    () => transcriptData?.contactsByRoot ?? {},
    [transcriptData?.contactsByRoot]
  );
  const exchangeMetaByKey = React.useMemo(
    () => transcriptData?.exchangeMetaByKey ?? {},
    [transcriptData?.exchangeMetaByKey]
  );

  const handleRefresh = React.useCallback(async () => {
    await refresh({ blocking: true });
  }, [refresh]);

  const nameFor = React.useCallback(
    (contactId: number | null, contactRootKey?: string): string => {
      if (contactId === null) return 'Unknown';
      if (contactIsAssistantSelf(assistant, contactId)) {
        return assistantDisplayName(assistant);
      }
      // Contact ids are root-local: prefer the row's own root, then fall back
      // to any root (covers rows that predate per-root contact provisioning).
      const pools = contactRootKey
        ? [contactsByRoot[contactRootKey] ?? [], ...Object.values(contactsByRoot)]
        : Object.values(contactsByRoot);
      for (const pool of pools) {
        const contact = pool.find((c) => c.contactId === contactId);
        if (contact) {
          return [contact.firstName, contact.surname].filter(Boolean).join(' ') || 'Unknown';
        }
      }
      return `#${contactId}`;
    },
    [contactsByRoot, assistant]
  );

  const scopeLabelFor = React.useCallback(
    (key: string): string | null => {
      if (scope.root !== null || !scope.showFilter) return null;
      return scope.options.find((option) => option.key === key)?.label ?? key;
    },
    [scope.root, scope.showFilter, scope.options]
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
    const byExchange = new Map<string, ScopedTranscriptRow[]>();
    for (const row of sortedAsc) {
      const key = threadKeyForRow(row);
      if (!byExchange.has(key)) byExchange.set(key, []);
      byExchange.get(key)!.push(row);
    }
    const built = Array.from(byExchange.entries()).map(([threadId, messages]) => {
      const last = messages[messages.length - 1];
      const participants = new Set<number>();
      messages.forEach((m) => {
        if (m.senderId !== null) participants.add(m.senderId);
        (m.receiverIds ?? []).forEach((id) => participants.add(id));
      });
      // Chat threads group every message under one synthetic key, so they have
      // no single exchange to carry a recording; call threads group per
      // exchange and do.
      const meta = exchangeMetaByKey[exchangeKey(last.rootKey, last.exchangeId) ?? ''] ?? null;
      const recordingStartedAt = recordingStartedAtFrom(meta);
      const cues: UtteranceCue[] = [];
      for (const message of messages) {
        // A typed line has an offset but no audio, so it must not become a cue:
        // the playhead would highlight it while the recording plays whatever was
        // being said at that moment.
        if (isChatFrom(message.metadata)) continue;
        const offsetSeconds =
          offsetFromRecordingStart(
            speechStartedAtFrom(message.metadata) ?? message.timestamp,
            recordingStartedAt
          ) ?? parseUtteranceOffset(message.metadata);
        if (offsetSeconds !== null) cues.push({ messageId: message.messageId, offsetSeconds });
      }
      return {
        threadId,
        rootKey: last.rootKey,
        messages,
        last,
        channel: channelForMedium(last.medium),
        subject: deriveSubject(messages),
        participantIds: Array.from(participants),
        recordingUrl: recordingUrlFrom(meta),
        recordingStartedAt,
        isCall: isCallExchange(meta),
        cues,
      };
    });
    built.sort(
      (a, b) =>
        new Date(b.last.timestamp ?? 0).getTime() - new Date(a.last.timestamp ?? 0).getTime()
    );
    if (!searchQuery.trim()) return built;
    const needle = searchQuery.trim().toLowerCase();
    return built.filter((thread) => {
      if (thread.subject.toLowerCase().includes(needle)) return true;
      if (
        thread.participantIds.some((id) =>
          nameFor(id, thread.rootKey).toLowerCase().includes(needle)
        )
      )
        return true;
      return thread.messages.some((m) => (m.content ?? '').toLowerCase().includes(needle));
    });
  }, [sortedAsc, searchQuery, nameFor, exchangeMetaByKey]);

  const threadGroups = React.useMemo(
    () =>
      groupByCalendarDay(
        threads.map((thread) => ({
          ...thread,
          sortTimestamp: thread.last.timestamp,
        }))
      ),
    [threads]
  );

  // A pill in chat can ask for one thread to be opened here. Clear the filters
  // that could exclude it first, otherwise the target is absent from `threads`
  // and the selection effect below immediately replaces it.
  const setScopeKey = scope.setActiveKey;
  React.useEffect(() => {
    if (!pendingTranscriptThread) return;
    setChannel('all');
    clearSearch();
    // The pane may be scoped to one root while the target sits in another;
    // `rootKey` doubles as the scope option key.
    setScopeKey(pendingTranscriptThread.rootKey);
  }, [pendingTranscriptThread, clearSearch, setScopeKey]);

  // Keep a valid selection as filters/search change, honouring a pending
  // request once the rows it refers to have arrived.
  React.useEffect(() => {
    if (threads.length === 0) {
      if (openThreadId !== null) setOpenThreadId(null);
      return;
    }
    if (pendingTranscriptThread) {
      const requested = `${pendingTranscriptThread.rootKey}:${pendingTranscriptThread.exchangeId}`;
      const found = threads.some((t) => t.threadId === requested);
      if (found) setOpenThreadId(requested);
      // Clear either way: the exchange can sit outside the loaded window, and a
      // request left pending would keep resetting the user's filters.
      clearPendingTranscriptThread();
      if (found) return;
    }
    if (!threads.some((t) => t.threadId === openThreadId)) {
      if (isStackedLayout) {
        setOpenThreadId(null);
      } else {
        setOpenThreadId(threads[0].threadId);
      }
    }
  }, [
    threads,
    openThreadId,
    isStackedLayout,
    pendingTranscriptThread,
    clearPendingTranscriptThread,
  ]);

  const activeThread =
    openThreadId !== null
      ? (threads.find((t) => t.threadId === openThreadId) ?? null)
      : isStackedLayout
        ? null
        : (threads[0] ?? null);

  // Playback position of the active thread's recording, used to highlight the
  // utterance currently being spoken. Reset when the reader switches threads so
  // a stale highlight cannot carry over.
  const playerRef = React.useRef<TranscriptRecordingPlayerHandle | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = React.useState<number | null>(null);
  const activeThreadId = activeThread?.threadId ?? null;
  React.useEffect(() => {
    setPlayheadSeconds(null);
  }, [activeThreadId]);

  const activeCueId = React.useMemo(() => {
    if (playheadSeconds === null || !activeThread?.cues.length) return null;
    return activeCueMessageId(activeThread.cues, playheadSeconds);
  }, [activeThread?.cues, playheadSeconds]);

  const seekTo = React.useCallback((seconds: number) => {
    playerRef.current?.seek(seconds);
  }, []);

  const flatMessages = React.useMemo<FlatMessage[]>(() => {
    const rows = [...filtered].sort(
      (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
    );
    const subjectByKey = new Map<string, string>();
    for (const thread of threads) subjectByKey.set(thread.threadId, thread.subject);
    return rows.map((message) => {
      const key = threadKeyForRow(message);
      return {
        message,
        threadSubject: subjectByKey.get(key) ?? deriveSubject([message]),
        channel: channelForMedium(message.medium),
      };
    });
  }, [filtered, threads]);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      data-testid="transcripts-pane"
    >
      {/* Toolbar: channel segments + search + refresh */}
      <TabToolbar
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearchSubmit={submitSearch}
        onSearchClear={clearSearch}
        searchPlaceholder={tabSearchPlaceholder('transcripts')}
        searchTestId="transcripts-search"
        searchClearTestId="transcripts-search-clear"
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh transcripts"
        trailing={<BrainScopeDropdown scope={scope} />}
        leading={
          <div className="flex flex-wrap items-center gap-2">
            <TabSegmentGroup testId="transcripts-view-mode">
              {(
                [
                  ['threads', 'Threads'],
                  ['feed', 'Feed'],
                ] as const
              ).map(([mode, label]) => (
                <TabSegment
                  key={mode}
                  label={label}
                  active={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                  testId={`transcripts-mode-${mode}`}
                />
              ))}
            </TabSegmentGroup>
            {isStackedLayout ? (
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger
                  className="h-7 w-[9.5rem] shrink-0"
                  data-testid="transcripts-channel-select"
                  aria-label="Filter by channel"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All ({channelCounts.all})</SelectItem>
                  {CHANNELS.map((channelDef) => (
                    <SelectItem key={channelDef.id} value={channelDef.id}>
                      {channelDef.label}
                      {channelCounts[channelDef.id] ? ` (${channelCounts[channelDef.id]})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <TabSegmentGroup testId="transcripts-channel-seg" className="hidden md:flex">
                <TabSegment
                  label="All"
                  active={channel === 'all'}
                  onClick={() => setChannel('all')}
                  count={channelCounts.all}
                />
                {CHANNELS.map((channelDef) => {
                  const active = channel === channelDef.id;
                  return (
                    <TabSegment
                      key={channelDef.id}
                      label={channelDef.label}
                      active={active}
                      onClick={() => setChannel(channelDef.id)}
                      icon={channelDef.Icon}
                      iconOnly
                      activeStyle={active ? { color: channelDef.cssVar } : undefined}
                      title={`${channelDef.label}${channelCounts[channelDef.id] ? ` · ${channelCounts[channelDef.id]}` : ''}`}
                      testId={`transcripts-channel-${channelDef.id}`}
                    />
                  );
                })}
              </TabSegmentGroup>
            )}
          </div>
        }
      />

      {/* Threads split: list + reader */}
      {isInitialLoading ? (
        <TabSplitSkeleton listRows={8} />
      ) : viewMode === 'feed' ? (
        <ScrollArea className="min-h-0 flex-1" viewportTestId="transcripts-feed">
          <div className="px-4 py-3">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              {flatMessages.map(({ message, threadSubject, channel: ch }) => {
                const isAssistant = contactIsAssistantSelf(assistant, message.senderId);
                const senderName = isAssistant
                  ? assistantDisplayName(assistant)
                  : nameFor(message.senderId, message.rootKey);
                return (
                  <button
                    key={message.messageId}
                    type="button"
                    className="flex w-full gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
                    onClick={() => {
                      setViewMode('threads');
                      setOpenThreadId(threadKeyForRow(message));
                    }}
                  >
                    <ContactAvatar
                      assistant={assistant}
                      contactId={message.senderId}
                      displayName={senderName}
                      initials={initialsFor(senderName)}
                      toneColor={isAssistant ? 'var(--primary)' : toneFor(message.senderId ?? 0)}
                      className="h-[30px] w-[30px]"
                      textClassName="text-[11px]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-baseline gap-2">
                        <b className="text-[12px] font-semibold">{senderName}</b>
                        <span className="text-caption" style={{ color: ch?.cssVar }}>
                          {ch?.label ?? 'Other'}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-body-dense text-ink-2 line-clamp-2">
                        {messageBody(message.content)}
                      </p>
                      <p className="text-caption mt-1 truncate">{threadSubject}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      ) : threads.length === 0 ? (
        <p className="text-body-muted p-8 text-center">No conversations yet.</p>
      ) : (
        <SplitPaneLayout
          paneId="transcripts-threads"
          defaultWidth={288}
          mobileMode="stack"
          stackBelow="shellCompact"
          detailOpen={openThreadId !== null && activeThread !== null}
          onDetailClose={() => setOpenThreadId(null)}
          mobileBackLabel="Threads"
          mobileBackTestId="transcripts-mobile-back"
          left={
            <ScrollArea
              className="h-full min-w-0"
              viewportClassName="min-w-0 overflow-x-hidden [&>div]:!block"
              viewportTestId="transcripts-threads"
            >
              <div className="flex flex-col gap-1 p-2">
                {threadGroups.map((group) => (
                  <React.Fragment key={group.sortKey}>
                    {group.sortKey === '__undated' ? (
                      <div className="mb-1 mt-2.5 flex min-w-0 items-center gap-2.5 px-1 first:mt-0">
                        <span className="text-overline">Undated</span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    ) : (
                      <TimelineDateSeparator
                        timestamp={group.items[0]!.sortTimestamp!}
                        className="px-1"
                      />
                    )}
                    {group.items.map((thread) => {
                      const channelDef = thread.channel;
                      const Icon = channelDef?.Icon ?? MessageSquare;
                      const ch = channelDef?.cssVar ?? 'var(--muted-ink)';
                      const active = activeThread?.threadId === thread.threadId;
                      return (
                        <button
                          key={String(thread.threadId)}
                          type="button"
                          onClick={() => setOpenThreadId(thread.threadId)}
                          data-testid={`transcripts-thread-${thread.threadId}`}
                          style={
                            {
                              '--ch': ch,
                              ...(active
                                ? {
                                    backgroundColor:
                                      'color-mix(in srgb, var(--ch) 12%, transparent)',
                                  }
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
                            <div className="text-title break-words">{thread.subject}</div>
                            <div className="text-caption mt-0.5 truncate">
                              <span style={{ color: ch }}>{channelDef?.label ?? 'Other'}</span> ·{' '}
                              {thread.messages.length} msg · {thread.participantIds.length} people
                              {scopeLabelFor(thread.rootKey) ? (
                                <> · {scopeLabelFor(thread.rootKey)}</>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </ScrollArea>
          }
          right={
            activeThread ? (
              <ScrollArea className="h-full min-w-0 flex-1" viewportTestId="transcripts-reader">
                <div
                  className="flex min-w-0 flex-col"
                  style={
                    {
                      '--ch': activeThread.channel?.cssVar ?? 'var(--muted-ink)',
                    } as React.CSSProperties
                  }
                >
                  <div className="sticky top-0 z-[1] border-b border-border bg-background px-3 py-3 sm:px-6 sm:py-4">
                    <div className="mb-3 flex items-start gap-3">
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
                        <div className="text-h2 break-words">{activeThread.subject}</div>
                        <div className="text-caption mt-0.5">
                          {activeThread.channel?.label ?? 'Other'} · {activeThread.messages.length}{' '}
                          messages
                          {scopeLabelFor(activeThread.rootKey) ? (
                            <> · {scopeLabelFor(activeThread.rootKey)}</>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {activeThread.recordingUrl ? (
                      <TranscriptRecordingPlayer
                        key={activeThread.threadId}
                        ref={playerRef}
                        recordingUrl={activeThread.recordingUrl}
                        onTimeUpdate={setPlayheadSeconds}
                      />
                    ) : activeThread.isCall ? (
                      <div
                        className="text-caption mb-3 rounded-[11px] border border-border bg-card-2 px-2.5 py-1.5"
                        data-testid="transcript-recording-none"
                      >
                        No recording for this call
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-overline mr-0.5 inline-flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden="true" /> Participants
                      </span>
                      {activeThread.participantIds.map((id) => (
                        <span
                          key={id}
                          className="text-caption inline-flex items-center gap-1.5 rounded-full border border-border bg-card-2 py-[3px] pl-[3px] pr-2.5 text-foreground"
                        >
                          <ContactAvatar
                            assistant={assistant}
                            contactId={id}
                            displayName={nameFor(id, activeThread.rootKey)}
                            initials={initialsFor(nameFor(id, activeThread.rootKey))}
                            toneColor={
                              contactIsAssistantSelf(assistant, id) ? 'var(--primary)' : toneFor(id)
                            }
                            className="h-5 w-5"
                            textClassName="text-[9px]"
                            shape="circle"
                          />
                          {nameFor(id, activeThread.rootKey)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 px-3 py-4 sm:px-6 sm:py-5">
                    {activeThread.messages.map((message) => {
                      const isAssistant = contactIsAssistantSelf(assistant, message.senderId);
                      const out = message.senderId !== null && !isAssistant;
                      const senderName = isAssistant
                        ? assistantDisplayName(assistant)
                        : nameFor(message.senderId, message.rootKey);
                      const receivers = message.receiverIds ?? [];
                      const isChat = isChatFrom(message.metadata);
                      const offsetSeconds =
                        offsetFromRecordingStart(
                          speechStartedAtFrom(message.metadata) ?? message.timestamp,
                          activeThread.recordingStartedAt
                        ) ?? parseUtteranceOffset(message.metadata);
                      return (
                        <TranscriptMessageRow
                          key={message.messageId}
                          assistant={assistant}
                          contactId={message.senderId}
                          out={out}
                          channelVar={activeThread.channel?.cssVar ?? 'var(--primary)'}
                          senderName={senderName}
                          senderTone={
                            isAssistant ? 'var(--primary)' : toneFor(message.senderId ?? 0)
                          }
                          receiverSummary={
                            receivers.length > 0
                              ? `to ${receivers.map((id) => nameFor(id, message.rootKey)).join(', ')}`
                              : null
                          }
                          timeLabel={formatTime(message.timestamp)}
                          body={messageBody(message.content)}
                          offsetSeconds={
                            activeThread.recordingUrl && !isChat ? offsetSeconds : null
                          }
                          isChat={isChat}
                          isPlaying={activeCueId === message.messageId}
                          onSeek={seekTo}
                        />
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-body-muted flex h-full items-center justify-center">
                Select a thread
              </div>
            )
          }
        />
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
  assistant,
  contactId,
  out,
  channelVar,
  senderName,
  senderTone,
  receiverSummary,
  timeLabel,
  body,
  offsetSeconds,
  isChat,
  isPlaying,
  onSeek,
}: {
  assistant: Assistant;
  contactId: number | null;
  out: boolean;
  channelVar: string;
  senderName: string;
  senderTone: string;
  receiverSummary: string | null;
  timeLabel: string;
  body: string;
  /** Offset into the call recording, when one is attached to this thread. */
  offsetSeconds: number | null;
  /** Typed in the meeting chat rather than spoken. */
  isChat: boolean;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
}) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: body,
    copyMessage: 'Message copied',
    showSuccessNotification: false,
  });

  return (
    <div
      className={cn(
        'group flex w-full max-w-full gap-2 sm:max-w-[82%] sm:gap-3',
        out && 'ml-auto flex-row-reverse self-end'
      )}
    >
      <ContactAvatar
        assistant={assistant}
        contactId={contactId}
        displayName={senderName}
        initials={initialsFor(senderName)}
        toneColor={senderTone}
        className="h-[30px] w-[30px]"
        textClassName="text-[11px]"
      />
      <div
        className={cn(
          'min-w-0 rounded-[13px] border border-border px-3.5 py-2.5 transition-colors',
          out
            ? 'border-[color:color-mix(in_srgb,var(--ch)_26%,transparent)] bg-[color:color-mix(in_srgb,var(--ch)_12%,var(--card-2))]'
            : 'bg-card-2',
          isPlaying && 'border-[color:var(--ch)] ring-1 ring-[color:var(--ch)]'
        )}
        style={{ '--ch': channelVar } as React.CSSProperties}
        data-playing={isPlaying ? 'true' : undefined}
      >
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          {isChat && (
            <MessageSquare
              className="h-3 w-3 shrink-0 self-center text-muted-foreground"
              aria-label="Sent in the meeting chat"
              data-testid="transcript-chat-icon"
            />
          )}
          <b className="text-[12px] font-semibold text-foreground">{senderName}</b>
          {receiverSummary && (
            <span className="text-[11px] text-muted-foreground">{receiverSummary}</span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">{timeLabel}</span>
          {offsetSeconds !== null && (
            <button
              type="button"
              onClick={() => onSeek(offsetSeconds)}
              aria-label={`Play recording from ${formatClock(offsetSeconds)}`}
              title="Play from here"
              data-testid="transcript-seek-button"
              className="inline-flex items-center gap-1 rounded px-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-[color:var(--ch)]"
            >
              <Play className="h-2.5 w-2.5" aria-hidden="true" />
              {formatClock(offsetSeconds)}
            </button>
          )}
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
        <div className="text-ink-2 min-w-0 break-words text-[13px] leading-relaxed">
          <ChatMarkdown content={body} />
        </div>
      </div>
    </div>
  );
}
