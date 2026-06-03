'use client';

import * as React from 'react';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import {
  RightPaneContainer,
  DEFAULT_RIGHT_PANE_STATE,
  type RightPaneState,
  type RightPaneTab,
} from '@/components/Pages/Assistants/RightPaneContainer';
import {
  Assistant,
  AssistantActions,
  AssistantFormData,
  AssistantPreset,
  AssistantUpdatePayload,
  VoiceOption,
} from '@/types/assistants/assistant';
import { ContactType } from '@/types/assistants/contact';
import { toast } from 'sonner';
import { AssistantHire } from './Hire/AssistantHire';
import { AssistantEdit } from './Edit/AssistantEdit';
import { HireForm } from '@/components/Pages/Assistants/Hire/AssistantHireForm';
import { PresetsPanel } from './Hire/Presets/AssistantHirePresetsList';
import { useAssistants } from '@/hooks/Assistants/useAssistants';
import { useAssistantPresets } from '@/hooks/Assistants/useAssistantPresets';
import { useAssistantForm } from '@/hooks/Assistants/useAssistantForm';
import { usePanelManager } from '@/hooks/Assistants/usePanelManager';
import { useCreditGrantLink } from '@/hooks/Billing/useCreditGrantLink';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';
import { useBillingEvents } from '@/hooks/Billing/useBillingEvents';
import { AssistantsBanners } from './AssistantsBanners';
import { StripeSidePanel } from '@/components/Billing/StripeSidePanel';
import { useAssistantStatus } from '@/hooks/Assistants/useAssistantStatus';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { useAssistantOnboardingSummaries } from '@/hooks/Assistants/useAssistantOnboardingSummaries';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormProvider } from 'react-hook-form';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import { getLangCodeForNationality } from '@/utils/assistants/voice-utils';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage, CallPill } from '@/types/assistants/chat';
import { AssistantHireLocalSetupInstructionsDialog } from './Hire/AssistantHireLocalSetupInstructions';
import { AssistantContactManager } from './Profile/AssistantContactManager';
import { AssistantWorkspaceManager } from './Profile/AssistantWorkspaceManager';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import { useContactIdPrefetch } from '@/hooks/Assistants/useContactIdPrefetch';
import {
  useAssistantChatStream,
  type ChatStreamPair,
} from '@/hooks/Assistants/useAssistantChatStream';
import { contactScopedRootQueries } from '@/lib/assistants/scope';
import {
  useAssistantTranscriptReconciler,
  type TranscriptReconcilerPair,
} from '@/hooks/Assistants/useAssistantTranscriptReconciler';
import { useUnreadDocumentTitle } from '@/hooks/Assistants/useUnreadDocumentTitle';
import type { ParsedInboundChatMessage } from '@/utils/assistants/chat-sse-frame';
import type { BroadcastMessagePayload } from '@/types/assistants/chat';
import type { SlackInstall, SlackInstallOwner } from '@/types/slack/install';
import { LogLevel, Room, setLogLevel } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { AssistantCommunicationDialog } from './Communication/AssistantCommunicationDialog';
import { useUserSpending } from '@/hooks/User/useUserSpending';
import { useOrgSpending } from '@/hooks/Organizations/useOrgSpending';
import { useSearchParams } from 'next/navigation';
import { useSpendingGate } from '@/hooks/Assistants/useSpendingGate';
import { SpendingDisplayProps } from '@/types/assistants/spending';
import { useAssistantSystemErrors } from '@/hooks/Assistants/useAssistantSystemErrors';
import { seedMediaSignedUrls } from '@/lib/client/assistant';
import type { SpaceSummary } from '@/types/spaces/space';

const EMPTY_SPACES: SpaceSummary[] = [];

interface MainProps {
  assistantActions: AssistantActions;
  userMeta: {
    image: string | null | undefined;
    timezone?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    whatsappNumber?: string | null;
    discordId?: string | null;
    orgId?: number | null;
    isOrgContext?: boolean;
    isFreeTrial?: boolean;
    mfaSetupRequired?: boolean;
    /** Owner scope for the shared Slack install (null when Slack OAuth
     *  is not configured on the deployment). */
    slackOwner?: SlackInstallOwner | null;
    /** Whether the current user may connect/disconnect the workspace
     *  Slack install (org owner, or the personal-account owner). */
    slackCanManageInstall?: boolean;
    /** Server-prefetched shared Slack install for the active workspace. */
    slackInitialInstall?: SlackInstall | null;
  };
}

async function fetchVisibleSpaces(): Promise<SpaceSummary[]> {
  const response = await fetch('/api/spaces', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load spaces');
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected spaces response');
  }
  return data as SpaceSummary[];
}

function isSignedMediaUrl(url: string | null | undefined): url is string {
  return Boolean(url && (url.startsWith('https://') || url.startsWith('http://')));
}

export default function Main({ assistantActions, userMeta }: MainProps) {
  // --- UI Panel Management ---
  const { profileAssistantId, handleShowProfile, handleProfileClose } = usePanelManager();

  // Right-pane state (primary tab, optional secondary tab for split-view,
  // splitter ratio) is lifted out of `RightPaneContainer` for two reasons:
  //   1. Unread suppression below needs to know whether *either* slot is
  //      showing the Chat tab to decide if the user is "viewing chat" for
  //      the selected assistant.
  //   2. Split layout / ratio is persisted across reloads via localStorage
  //      so power users keep their preferred two-pane setup.
  // Reset to single-Chat on assistant change — a fresh open should land
  // on the conversation, not on whatever split the previous assistant
  // had configured.
  const RIGHT_PANE_STORAGE_KEY = 'console:assistants:rightPaneState';
  const [paneState, setPaneState] = React.useState<RightPaneState>(DEFAULT_RIGHT_PANE_STATE);

  // Hydrate persisted layout post-mount (avoids SSR mismatch). On mobile
  // we forcibly drop any persisted secondary slot — split is desktop-only,
  // and surfacing a half-pane on a phone would be unusable.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RIGHT_PANE_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<RightPaneState> | null;
      if (!parsed || typeof parsed !== 'object') return;
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      // Migrate legacy 'secrets' tab id (renamed to 'integrations' when
      // the per-assistant Integrations tab landed). Drops cleanly once
      // every persisted state has been visited at least once after the
      // rename.
      const migrateTabId = (tab: unknown): RightPaneTab | null => {
        if (typeof tab !== 'string') return null;
        if (tab === 'secrets') return 'integrations';
        return tab as RightPaneTab;
      };
      const primaryTab = migrateTabId(parsed.primary?.tab) ?? 'chat';
      const secondaryTab =
        !isMobile && parsed.secondary?.tab ? migrateTabId(parsed.secondary.tab) : null;
      setPaneState({
        primary: { tab: primaryTab },
        secondary: secondaryTab ? { tab: secondaryTab } : null,
        splitRatio: typeof parsed.splitRatio === 'number' ? parsed.splitRatio : 0.5,
      });
    } catch {
      // localStorage may be unavailable (private mode, etc.) — ignore.
    }
  }, []);

  // Persist layout changes (best-effort; ignore quota/private-mode failures).
  React.useEffect(() => {
    try {
      window.localStorage.setItem(RIGHT_PANE_STORAGE_KEY, JSON.stringify(paneState));
    } catch {
      /* ignore */
    }
  }, [paneState]);

  // Collapse to primary-only on viewport shrink to mobile so a stored
  // split doesn't suddenly look broken when the user resizes their window.
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setPaneState((prev) => (prev.secondary ? { ...prev, secondary: null } : prev));
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  React.useEffect(() => {
    setPaneState((prev) => ({ ...prev, primary: { tab: 'chat' }, secondary: null }));
  }, [profileAssistantId]);

  // Convenience: chat is "visible" if either slot is showing it. Used by
  // the chat-stream hook below to suppress unread bumps and by the
  // mark-as-read effect to clear the badge when an assistant is opened.
  const isChatVisibleInRightPane =
    paneState.primary.tab === 'chat' ||
    (paneState.secondary !== null && paneState.secondary.tab === 'chat');

  // --- Assistant List Fold / Resize State ---
  const LIST_SNAP_THRESHOLD = 150;
  const LIST_DEFAULT_WIDTH = 240;
  const LIST_MIN_WIDTH = 56;
  const LIST_MAX_WIDTH = 500;

  const isMobileRef = React.useRef(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const [assistantListWidth, setAssistantListWidth] = React.useState(
    isMobileRef.current ? LIST_MIN_WIDTH : LIST_DEFAULT_WIDTH
  );
  const [isAssistantListFolded, setIsAssistantListFolded] = React.useState(isMobileRef.current);
  const [isResizingList, setIsResizingList] = React.useState(false);
  const preSnapWidthRef = React.useRef(LIST_DEFAULT_WIDTH);

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => {
      isMobileRef.current = e.matches;
      if (e.matches) {
        setIsAssistantListFolded(true);
        setAssistantListWidth(LIST_MIN_WIDTH);
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleToggleListFold = React.useCallback(() => {
    if (isAssistantListFolded) {
      setIsAssistantListFolded(false);
      setAssistantListWidth(preSnapWidthRef.current || LIST_DEFAULT_WIDTH);
    } else {
      preSnapWidthRef.current = assistantListWidth;
      setIsAssistantListFolded(true);
      setAssistantListWidth(LIST_MIN_WIDTH);
    }
  }, [isAssistantListFolded, assistantListWidth]);

  const handleListResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingList(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startX = e.clientX;
      const startWidth = isAssistantListFolded ? LIST_MIN_WIDTH : assistantListWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);

        if (newWidth < LIST_SNAP_THRESHOLD) {
          // Snap to folded
          if (!isAssistantListFolded) {
            preSnapWidthRef.current = startWidth;
          }
          setIsAssistantListFolded(true);
          setAssistantListWidth(LIST_MIN_WIDTH);
        } else {
          // Expanded mode
          setIsAssistantListFolded(false);
          const clampedWidth = Math.min(LIST_MAX_WIDTH, Math.max(LIST_SNAP_THRESHOLD, newWidth));
          setAssistantListWidth(clampedWidth);
        }
      };

      const handleMouseUp = () => {
        setIsResizingList(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [assistantListWidth, isAssistantListFolded]
  );

  // --- Assistant Data & Actions ---
  const {
    assistants,
    setAssistants,
    isLoading: isLoadingAssistants,
    error: assistantError,
    refreshAssistants,
    deleteAssistant,
    updateAssistantProfile,
  } = useAssistants(assistantActions, !!userMeta.isOrgContext);

  // Pulled out of the workspace context so we can do strict ownership
  // checks (e.g. who sees the setup roadmap) — `canWrite` is broader
  // and includes org owners/admins, which isn't the same audience.
  const { activeWorkspace, currentUserId } = useWorkspace();

  const hasSpaceMemberships = React.useMemo(
    () => assistants.some((assistant) => (assistant.spaceIds?.length ?? 0) > 0),
    [assistants]
  );

  const spacesQuery = useQuery({
    queryKey: ['visible-spaces', currentUserId ?? 'anonymous', activeWorkspace?.id ?? 'personal'],
    queryFn: fetchVisibleSpaces,
    enabled: hasSpaceMemberships,
    staleTime: 5 * 60 * 1000,
  });
  const visibleSpaces = spacesQuery.data ?? EMPTY_SPACES;

  const spacesById = React.useMemo<Record<number, SpaceSummary>>(() => {
    return Object.fromEntries(visibleSpaces.map((space) => [space.spaceId, space]));
  }, [visibleSpaces]);

  // --- Deep-link to a specific assistant via ?profile=<agentId> ---
  const searchParams = useSearchParams();
  const profileParam = searchParams.get('profile');
  const hasOpenedDeepLink = React.useRef(false);
  React.useEffect(() => {
    if (profileParam && assistants.length > 0 && !hasOpenedDeepLink.current) {
      const match = assistants.find((a) => a.agentId === profileParam);
      if (match) {
        hasOpenedDeepLink.current = true;
        handleShowProfile(match.agentId);
      }
    }
  }, [profileParam, assistants, handleShowProfile]);

  // --- Assistant Status Polling ---
  const { statuses: assistantStatuses, markOnline: markAssistantOnline } =
    useAssistantStatus(assistants);

  // --- Assistant Permissions ---
  const { canHire, canWrite, canDelete } = useAssistantPermissions();

  // --- Billing Status & Credit Grant Link ---
  const {
    credits,
    accountStatus,
    billingMode,
    isLoading: isBillingLoading,
    refetch: refetchBillingStatus,
    startPolling: startBillingPolling,
  } = useBillingStatus();
  useBillingEvents();
  const { pendingToken, claimPendingToken } = useCreditGrantLink();
  const [isStripePanelOpen, setIsStripePanelOpen] = React.useState(false);

  // --- Dialogs & Forms ---
  const [isHireDialogOpen, setIsHireDialogOpen] = React.useState(false);
  const [assistantToEdit, setAssistantToEdit] = React.useState<Assistant | null>(null);
  const [contactManagerAssistant, setContactManagerAssistant] = React.useState<Assistant | null>(
    null
  );
  const [contactManagerInitialTab, setContactManagerInitialTab] =
    React.useState<ContactType>('email');
  const [workspaceManagerAssistant, setWorkspaceManagerAssistant] =
    React.useState<Assistant | null>(null);
  const [isAssistantPresetsOpen, setIsAssistantPresetsOpen] = React.useState(true);
  const [isDialogBusyProcessingPhoto, setIsDialogBusyProcessingPhoto] = React.useState(false);
  const [isDialogBusyProcessingVoice, setIsDialogBusyProcessingVoice] = React.useState(false);
  const [newlyHiredInfo, setNewlyHiredInfo] = React.useState<{
    assistant: Assistant;
    preHireChat?: ChatMessage[];
  } | null>(null);
  const [profileChatHistories, setProfileChatHistories] = React.useState<
    Record<string, ChatMessage[]>
  >({});
  const [callPillHistories, setCallPillHistories] = React.useState<Record<string, CallPill[]>>({});

  // --- Prefetch contact IDs, transcripts, AND call pills for all loaded assistants ---
  // Resolves contact IDs and fetches transcript history + meet call pills in
  // the background as soon as the assistant list is available.
  // Contact IDs go into sessionStorage AND are surfaced as React state so the
  // page-level inbox multiplex below can join new assistants without polling.
  // Transcripts and call pills go directly into their respective state maps
  // (write-if-absent). When the user opens a chat, all data is already
  // cached — the chat loads instantly with zero loading/skeleton state.
  const resolvedContactIds = useContactIdPrefetch(
    assistants,
    assistantActions,
    userMeta.email,
    setProfileChatHistories,
    setCallPillHistories
  );

  // --- Call Management ---
  // Lifted above the chat-stream hook so the stream can use the active-call
  // assistant as a fallback for `activeAssistantId` (prevents the in-call
  // side-panel chat from flashing an unread badge for the very assistant
  // the user is talking to).
  const room = React.useMemo(() => {
    setLogLevel(LogLevel.warn);
    return new Room();
  }, []);
  const {
    isConnecting: isConnectingCall,
    isConnected: isCallConnected,
    activeCallAssistant,
    callType,
    connectionDetails,
    connect: startCall,
    disconnect: hangUpCall,
    isSpeakerMuted,
    toggleSpeakerMute,
    isWaitingForAssistant,
    waitingMessage,
    connectionError,
    retryConnection,
    isDesktopReady,
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isRemoteControlInteractive,
    isRemoteControlInteractiveLoading,
    toggleRemoteControlInteractive,
  } = useAssistantCall(room, assistantActions);

  // --- Page-level chat SSE stream ---
  // Single SSE connection that demultiplexes Pub/Sub chat topics for every
  // assistant in the workspace. Drives (a) unread badges on the list, (b)
  // the currently-open chat panel's message history, (c) the typing
  // indicator via `activityCounters`, and (d) the per-assistant online
  // status via `markAssistantOnline`.
  //
  // Pairs are assembled from the `resolvedContactIds` state that
  // `useContactIdPrefetch` maintains; as new IDs resolve, React batches the
  // updates and the stream reconnects once per render pass rather than once
  // per network response.
  const chatStreamPairs = React.useMemo<ChatStreamPair[]>(
    () =>
      assistants
        .flatMap((a) => {
          const cid = resolvedContactIds[a.agentId];
          if (cid === undefined) return [];
          const seenPairs = new Set<string>();
          return contactScopedRootQueries(a, cid, 'Transcripts').flatMap((query) => {
            const pairKey = `${query.contactId}:${query.rootKey}`;
            if (seenPairs.has(pairKey)) return [];
            seenPairs.add(pairKey);
            return [
              {
                assistantId: a.agentId,
                contactId: query.contactId,
                rootKey: query.rootKey,
                sourceContext: query.context,
              },
            ];
          });
        })
        .filter((p): p is ChatStreamPair => p !== null),
    [assistants, resolvedContactIds]
  );

  // Per-assistant monotonic counter bumped on every inbound SSE frame.
  // Consumed by the chat panel (via props) to clear its typing indicator
  // when the assistant starts replying.
  const [chatActivityCounters, setChatActivityCounters] = React.useState<Record<string, number>>(
    {}
  );
  const handleChatActivity = React.useCallback((assistantId: string) => {
    setChatActivityCounters((prev) => ({
      ...prev,
      [assistantId]: (prev[assistantId] ?? 0) + 1,
    }));
  }, []);

  // `ackMessage` is returned by `useAssistantChatStream` below, but we need
  // to reference it from inside `handleChatStreamMessage`, which is passed
  // INTO that hook. The ref sidesteps the temporal ordering: we update it
  // on every render once the hook has returned.
  const ackMessageRef = React.useRef<
    (assistantId: string, contactId: number, rootKey: string, ackId: string) => void
  >(() => {});

  // Per-assistant publish-time cutoff for the chat SSE filter. The ref is
  // rebuilt from `profileChatHistories` whenever histories change, and
  // `useAssistantChatStream` reads it on every inbound frame via
  // `getCutoff` below — so anything Pub/Sub redelivers that we already have
  // in chat history (transcripts, prefetch, prior session) gets dropped at
  // parse time before it can reach `setProfileChatHistories`.
  //
  // Why assistant-role only: Pub/Sub only delivers assistant-outbound
  // messages, so only those carry a `publishTime` we can meaningfully
  // compare against. Including user-side optimistic timestamps in the
  // cutoff would be unsafe — `useAssistantProfileChat.sendMessage` clamps
  // them forward to `max(client_now, lastTs + 1)` to defend against
  // client clock skew, which can push them past the server's actual
  // wall-clock when the client clock is ahead. A subsequent assistant
  // reply could then arrive with `publishTime < clamped_user_time` and
  // get filtered out as if it were a redelivery.
  //
  // Why `+ 1`: SSE-delivered messages carry a Pub/Sub message id while
  // the copy already in `profileChatHistories` (loaded by transcripts /
  // prefetch) carries the Orchestra log-entry id, so id-based dedup
  // can't recognise them as the same logical message. The two copies
  // share the same `publishTime`, so a `<` cutoff at exactly the latest
  // timestamp would let the redelivery slip through. Bumping the cutoff
  // by 1 ms makes the filter cover the last-seen message too. The only
  // downside is a brand-new assistant message that lands at the exact
  // same millisecond as the previous one would be filtered, but the
  // page-level transcript reconciler (`useAssistantTranscriptReconciler`)
  // picks it up on the next poll (~30 s when SSE is healthy).
  const chatStreamCutoffsRef = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const next: Record<string, number> = {};
    for (const [assistantId, msgs] of Object.entries(profileChatHistories)) {
      if (!msgs || msgs.length === 0) continue;
      let max = 0;
      for (const m of msgs) {
        if (m.role !== 'assistant') continue;
        const t = new Date(m.timestamp).getTime();
        if (t > max) max = t;
      }
      if (max > 0) next[assistantId] = max + 1;
    }
    chatStreamCutoffsRef.current = next;
  }, [profileChatHistories]);
  const getChatStreamCutoff = React.useCallback(
    (assistantId: string) => chatStreamCutoffsRef.current[assistantId] ?? 0,
    []
  );

  const handleChatStreamMessage = React.useCallback(
    (assistantId: string, parsed: ParsedInboundChatMessage) => {
      const { message, hasServerMessageId } = parsed;

      // Merge into chat history with id-based dedup — but ONLY for chats
      // whose transcripts have already been loaded into state.
      //
      // Why the gate: SSE-delivered messages carry the Pub/Sub message id
      // (set server-side in `/api/assistant/events/chat-stream`), whereas
      // server-loaded transcripts use the Orchestra log entry id. The two
      // never match, so eagerly merging an SSE delivery into a chat the
      // user hasn't opened yet would render a duplicate the moment the
      // panel opens and pulls fresh transcripts (which already include
      // the same message). For unopened chats we therefore drop the SSE
      // copy on the floor — the unread badge is bumped separately by
      // `useAssistantChatStream`, and the next transcript load is the
      // single source of truth for content.
      //
      // For chats that ARE loaded, the publish-time cutoff supplied to
      // `useAssistantChatStream` filters out backlog redeliveries before
      // they reach this handler, so anything we get here is genuinely new
      // and the id-based dedup below only ever fires on duplicate
      // redeliveries that arrived before the cutoff caught up.
      type MergeOutcome = 'skipped_no_history' | 'duplicate' | 'merged';
      const outcomeRef: { value: MergeOutcome } = { value: 'merged' };
      setProfileChatHistories((prev) => {
        const current = prev[assistantId];
        if (current === undefined) {
          outcomeRef.value = 'skipped_no_history';
          return prev;
        }
        if (hasServerMessageId && current.some((m) => m.id === message.id)) {
          outcomeRef.value = 'duplicate';
          return prev;
        }
        const lastMsg = current[current.length - 1];
        if (
          !hasServerMessageId &&
          lastMsg &&
          lastMsg.role === 'assistant' &&
          lastMsg.content === message.content
        ) {
          outcomeRef.value = 'duplicate';
          return prev;
        }
        const updated = [...current, message].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return { ...prev, [assistantId]: updated };
      });
      const mergeOutcome = outcomeRef.value;

      // Ack upstream on every delivery — including the "skipped, no
      // history" and dedup-hit cases — so Pub/Sub stops looping on us.
      // The server-side chat-stream route intentionally leaves messages
      // leased until this call arrives, so any drop is redelivered on
      // reconnect; once we've taken responsibility for the message
      // (whether by merging it or by letting the next transcript load
      // surface it) we have to release the lease.
      const ackId = message.__ackId;
      if (ackId) ackMessageRef.current(assistantId, parsed.contactId, parsed.rootKey, ackId);

      if (mergeOutcome === 'duplicate') return;

      // Mark the assistant as "online" in the list — an incoming message
      // is the strongest possible signal the process is reachable. This
      // applies to both merged and skipped-no-history cases.
      markAssistantOnline(assistantId);

      // Broadcast to sibling tabs so a second tab with the same chat open
      // renders the message even if Pub/Sub load-balanced the delivery to
      // this tab. Skipped-no-history doesn't broadcast: the receiving
      // tab's chat panel (if any) would face the same SSE-id vs
      // log-entry-id mismatch and end up with a phantom duplicate. Tabs
      // with the chat open will pick the message up either via their own
      // direct SSE delivery or via the in-panel polling reconciler.
      if (mergeOutcome !== 'merged') return;

      const broadcastMsg = { ...message };
      delete broadcastMsg.__ackId;
      try {
        const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
        const payload: BroadcastMessagePayload = {
          type: 'NEW_MESSAGE',
          message: broadcastMsg,
        };
        channel.postMessage(payload);
        channel.close();
      } catch {
        /* BroadcastChannel unsupported (very old browsers) */
      }
    },
    [markAssistantOnline]
  );

  const handleChatStreamDesktopReady = React.useCallback(
    (assistantId: string, eventData: Record<string, unknown>) => {
      try {
        sessionStorage.setItem(`desktop-ready-${assistantId}`, JSON.stringify(eventData));
      } catch {
        /* quota / SSR */
      }
      try {
        const desktopChannel = new BroadcastChannel(`assistant-desktop-ready-${assistantId}`);
        desktopChannel.postMessage(eventData);
        desktopChannel.close();
      } catch {
        /* BroadcastChannel unsupported */
      }
    },
    []
  );

  const {
    connectionStatusByAssistant: chatStreamConnectionStatusByAssistant,
    reconnect: reconnectChatStream,
    unreadCounts: chatStreamUnreadCounts,
    markAsRead: markChatStreamRead,
    ackMessage: ackChatStreamMessage,
  } = useAssistantChatStream(
    chatStreamPairs,
    chatStreamPairs.length > 0,
    {
      onChatMessage: handleChatStreamMessage,
      onDesktopReady: handleChatStreamDesktopReady,
      onMessageActivity: handleChatActivity,
    },
    {
      userEmail: userMeta.email ?? undefined,
      // Suppress unread bumps for whichever assistant chat the user is
      // currently looking at — either the profile chat panel (only when
      // the right-pane Chat tab is visible in *either* the primary or
      // secondary split slot; on Actions/Memory/etc.-only we still want
      // the badge to climb so the user notices) or, if no panel is open,
      // the call dialog's embedded side panel.
      activeAssistantId:
        (isChatVisibleInRightPane ? profileAssistantId : null) ??
        activeCallAssistant?.agentId ??
        null,
      getCutoff: getChatStreamCutoff,
    }
  );
  ackMessageRef.current = ackChatStreamMessage;

  // Page-level polling fallback for the chat SSE. Reconciles missed
  // messages into `profileChatHistories` for any assistant in the
  // workspace whose stream is unhealthy (or the active panel as a safety
  // net). Replaces the per-panel polling that used to live inside
  // `useAssistantProfileChat`.
  const reconcilerPairs = React.useMemo<TranscriptReconcilerPair[]>(
    () =>
      assistants
        .map((a) => {
          const cid = resolvedContactIds[a.agentId];
          if (cid === undefined) return null;
          return { assistantId: a.agentId, contactId: cid, assistant: a };
        })
        .filter((p): p is TranscriptReconcilerPair => p !== null),
    [assistants, resolvedContactIds]
  );
  useAssistantTranscriptReconciler({
    pairs: reconcilerPairs,
    connectionStatusByAssistant: chatStreamConnectionStatusByAssistant,
    activeAssistantId:
      (isChatVisibleInRightPane ? profileAssistantId : null) ??
      activeCallAssistant?.agentId ??
      null,
    enabled: reconcilerPairs.length > 0,
    chatHistories: profileChatHistories,
    setChatHistories: setProfileChatHistories,
  });

  // Surface the workspace-wide unread total in the browser tab title so
  // background tabs show a `(N) …` badge like a typical messaging app.
  // No UI-side masking needed for the selected assistant: the hook
  // already suppresses bumps when (and only when) the user is actually
  // viewing that chat (Chat tab + tab visible), so its count is
  // naturally 0 in exactly the case where we'd want to mask it.
  useUnreadDocumentTitle(chatStreamUnreadCounts);

  // Clear unread whenever the user opens a chat (or switches to a different
  // assistant's chat). The panel itself doesn't need to know about unread
  // counts — the page-level hook owns that state exclusively.
  React.useEffect(() => {
    // Only clear the unread badge when the user is actually looking at the
    // chat (Chat tab present in either split slot + assistant selected).
    // Selecting an assistant while on a non-chat tab leaves the badge in
    // place; switching either slot to the Chat tab is what marks it read.
    if (profileAssistantId && isChatVisibleInRightPane) {
      markChatStreamRead(profileAssistantId);
    }
  }, [profileAssistantId, isChatVisibleInRightPane, markChatStreamRead]);

  // Activity signal for the currently-open chat panel: the panel reads only
  // changes to this number, so passing 0 when no chat is open is fine.
  const profileChatActivitySignal = profileAssistantId
    ? (chatActivityCounters[profileAssistantId] ?? 0)
    : 0;

  const [setupInstructions, setSetupInstructions] = React.useState<{
    os: string;
    isOpen: boolean;
  } | null>(null);
  const [popOutCallAssistantId, setPopOutCallAssistantId] = React.useState<string | null>(null);

  const pongTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pongListenerRef = React.useRef<(event: StorageEvent) => void>();

  const verifyAndSetPopOutState = React.useCallback(() => {
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
    if (pongListenerRef.current) window.removeEventListener('storage', pongListenerRef.current);
    setPopOutCallAssistantId(null);

    try {
      const data = localStorage.getItem('activePopOutCall');
      if (!data) return;

      const popOutData = JSON.parse(data);
      const pingId = `ping-${Date.now()}`;

      pongListenerRef.current = (event: StorageEvent) => {
        if (event.key === 'popOutCallPong' && event.newValue === pingId) {
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          window.removeEventListener('storage', pongListenerRef.current!);
          setPopOutCallAssistantId(popOutData?.assistantId || null);
        }
      };

      window.addEventListener('storage', pongListenerRef.current);
      localStorage.setItem('popOutCallPing', pingId);
      setTimeout(() => localStorage.removeItem('popOutCallPing'), 2000);

      pongTimeoutRef.current = setTimeout(() => {
        window.removeEventListener('storage', pongListenerRef.current!);
        console.warn(
          "No response from pop-out call window. Clearing stale 'activePopOutCall' localStorage entry."
        );
        localStorage.removeItem('activePopOutCall');
        setPopOutCallAssistantId(null);
      }, 1500);
    } catch (e) {
      console.error('Error during pop-out verification, clearing state:', e);
      localStorage.removeItem('activePopOutCall');
      setPopOutCallAssistantId(null);
    }
  }, []);

  React.useEffect(() => {
    verifyAndSetPopOutState();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'activePopOutCall') {
        verifyAndSetPopOutState();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
      if (pongListenerRef.current) window.removeEventListener('storage', pongListenerRef.current);
    };
  }, [verifyAndSetPopOutState]);

  const [isCommunicationDialogOpen, setIsCommunicationDialogOpen] = React.useState(false);

  // --- User/Org Spending for Spending Gate ---
  // Stable disabled action functions (defined once, never changes)
  const disabledAction = React.useCallback(async () => ({ detail: 'disabled' }) as const, []);

  // User spending (personal workspace or member spending)
  const userSpendingConfig = React.useMemo(
    () => ({
      setLimitAction: disabledAction,
      enablePolling: true,
    }),
    [disabledAction]
  );

  const userSpendingData = useUserSpending(userSpendingConfig);

  // Org spending (only in org context)
  const orgSpendingConfig = React.useMemo(() => {
    if (!userMeta.orgId) {
      return {
        orgId: 0,
        setLimitAction: disabledAction,
        enablePolling: false,
      };
    }
    return {
      orgId: userMeta.orgId,
      setLimitAction: disabledAction,
      enablePolling: true,
    };
  }, [userMeta.orgId, disabledAction]);

  const orgSpendingData = useOrgSpending(orgSpendingConfig);

  // Track assistant spending display for currently selected profile assistant
  // This will be set by the AssistantProfilePanel when it loads spending data
  const [profileAssistantSpending, setProfileAssistantSpending] =
    React.useState<SpendingDisplayProps | null>(null);

  // Compute spending gate status
  // Check enablePolling to determine if spending data is actually enabled
  const isUserSpendingEnabled = userSpendingConfig.enablePolling;
  const isOrgSpendingEnabled = orgSpendingConfig.enablePolling;

  const spendingGateStatus = useSpendingGate({
    assistantSpending: profileAssistantSpending,
    userSpending: isUserSpendingEnabled ? userSpendingData.display : null,
    orgSpending: isOrgSpendingEnabled ? orgSpendingData.display : null,
    isLoading:
      (isUserSpendingEnabled ? userSpendingData.isLoading : false) ||
      (isOrgSpendingEnabled ? orgSpendingData.isLoading : false),
    isRefreshing:
      (isUserSpendingEnabled ? userSpendingData.isRefreshing : false) ||
      (isOrgSpendingEnabled ? orgSpendingData.isRefreshing : false),
    credits,
    isBillingLoading,
    billingMode,
    isFreeTrial: !!userMeta.isFreeTrial,
  });

  // Reset assistant spending when profile changes
  React.useEffect(() => {
    setProfileAssistantSpending(null);
  }, [profileAssistantId]);

  const handleStartCall = React.useCallback(
    async (assistant: Assistant, callType: 'video' | 'audio') => {
      const activeCallId = activeCallAssistant?.agentId || popOutCallAssistantId;
      if (activeCallId) {
        if (activeCallId === assistant.agentId) {
          if (popOutCallAssistantId) {
            toast.info(
              'Call is active in a separate tab. Close that tab to start a new call here.'
            );
          } else {
            setIsCommunicationDialogOpen(true);
          }
        } else {
          toast.info('A call is already in progress with another assistant.');
        }
        return;
      }

      setIsCommunicationDialogOpen(true);
      await startCall(assistant, callType);
    },
    [startCall, activeCallAssistant, popOutCallAssistantId]
  );

  const handleHangUp = React.useCallback(async () => {
    await hangUpCall();
    setIsCommunicationDialogOpen(false);
  }, [hangUpCall]);

  // Close dialog if connection fails during setup or is disconnected remotely
  React.useEffect(() => {
    if (connectionError) return; // Don't close if there's an error the user needs to see

    if (!isConnectingCall && !isCallConnected && isCommunicationDialogOpen) {
      setIsCommunicationDialogOpen(false);
    }
  }, [isConnectingCall, isCallConnected, isCommunicationDialogOpen, connectionError]);

  const {
    displayedPresets,
    loadMorePresets,
    canLoadMorePresets,
    isLoadingMorePresets,
    presetAgeFilter,
    setPresetAgeFilter,
    presetNationalityFilter,
    setPresetNationalityFilter,
    presetGenderFilter,
    setPresetGenderFilter,
    presetLanguageFilter,
    setPresetLanguageFilter,
    availableAgeBrackets,
    availableNationalities,
    availableGenders,
    availableLanguages,
    currentFilteredPresets,
    allAssistantPresets,
    presetPhotoUrls,
  } = useAssistantPresets({ enabled: isHireDialogOpen });

  // --- Voice Management Options ---
  const [justDeletedVoiceId, setJustDeletedVoiceId] = React.useState<string | null>(null);
  // Lazy load voices only when hire/edit dialogs are open
  const shouldLoadVoices = isHireDialogOpen || !!assistantToEdit;
  const {
    allDisplayableVoices: unsortedVoices,
    isLoadingUserVoices,
    fetchUserVoices,
    deleteUserVoice,
  } = useVoiceOptions(assistantActions.voice, { enabled: shouldLoadVoices });

  const handleFirstViewCompleted = React.useCallback(() => setNewlyHiredInfo(null), []);

  // --- Callbacks for form success ---
  const handleHireSuccess = React.useCallback(
    (newAssistant: Assistant, formData: AssistantFormData, preHireChat?: ChatMessage[]) => {
      const optimisticSignedUrlsByPath: Record<string, string> = {};
      const optimisticSignedPatch: Partial<
        Pick<Assistant, 'signedProfilePhotoUrl' | 'signedProfileVideoUrl'>
      > = {};

      const registerOptimisticSignedUrl = (
        mediaPath: string | null | undefined,
        signedUrl: string | null | undefined,
        field: 'signedProfilePhotoUrl' | 'signedProfileVideoUrl'
      ) => {
        if (!mediaPath || !isSignedMediaUrl(signedUrl)) return;
        optimisticSignedUrlsByPath[mediaPath] = signedUrl;
        optimisticSignedPatch[field] = signedUrl;
      };

      registerOptimisticSignedUrl(
        newAssistant.profilePhoto,
        newAssistant.signedProfilePhotoUrl,
        'signedProfilePhotoUrl'
      );
      registerOptimisticSignedUrl(
        newAssistant.profileVideo,
        newAssistant.signedProfileVideoUrl,
        'signedProfileVideoUrl'
      );
      registerOptimisticSignedUrl(
        formData.profilePhotoUrl,
        formData.photoPreviewUrl,
        'signedProfilePhotoUrl'
      );
      registerOptimisticSignedUrl(
        formData.profileVideoUrl,
        formData.videoPreviewUrl,
        'signedProfileVideoUrl'
      );

      if (Object.keys(optimisticSignedUrlsByPath).length > 0) {
        seedMediaSignedUrls(optimisticSignedUrlsByPath);
      }

      const optimisticAssistant: Assistant = {
        ...newAssistant,
        ...(formData.profilePhotoUrl && !newAssistant.profilePhoto
          ? { profilePhoto: formData.profilePhotoUrl }
          : {}),
        ...(formData.profileVideoUrl && !newAssistant.profileVideo
          ? { profileVideo: formData.profileVideoUrl }
          : {}),
        ...optimisticSignedPatch,
      };

      setIsHireDialogOpen(false);
      setAssistants((currentAssistants) => {
        const existingAssistant = currentAssistants.find(
          (assistant) => assistant.agentId === optimisticAssistant.agentId
        );
        if (!existingAssistant) {
          return [optimisticAssistant, ...currentAssistants];
        }
        return currentAssistants.map((assistant) =>
          assistant.agentId === optimisticAssistant.agentId
            ? { ...assistant, ...optimisticAssistant }
            : assistant
        );
      });
      setNewlyHiredInfo({ assistant: optimisticAssistant, preHireChat });
      handleShowProfile(optimisticAssistant.agentId);
      // Capture the OS for local-mode hires so the setup roadmap's
      // "Show install instructions" step can re-open the dialog later
      // with the correct platform — we don't auto-pop here anymore;
      // the user opts in from the in-panel roadmap when ready.
      if (formData.setup === 'local' && formData.operatingSystem) {
        setHireOsByAgentId((prev) => ({
          ...prev,
          [optimisticAssistant.agentId]: formData.operatingSystem as string,
        }));
      }

      refreshAssistants(false);
      fetchUserVoices();
      refetchBillingStatus();
    },
    [refreshAssistants, handleShowProfile, refetchBillingStatus, fetchUserVoices, setAssistants]
  );

  const handleUpdateSuccess = React.useCallback(
    (updatedPayload?: Partial<AssistantUpdatePayload>) => {
      refreshAssistants(false);
      setAssistantToEdit(null);
      setContactManagerAssistant(null);
      // Note: desktopMode is set at creation time only and cannot be updated,
      // so we no longer show setup instructions on update
    },
    [refreshAssistants]
  );

  // --- Combined Hire/Edit Form Hook ---
  const {
    formMethods,
    initiateHireSequence,
    isCheckingBalance,
    isSubmitting: isFormSubmitting,
    showInsufficientFundsHint,
    setShowInsufficientFundsHint,
    selectPreset: selectPresetForHireForm,
    resetForm: resetHireFormInternal,
    loadAssistantForEdit,
    initiateUpdate,
    onNewMediaReady,
  } = useAssistantForm(
    assistantActions,
    unsortedVoices,
    handleHireSuccess,
    handleUpdateSuccess,
    isHireDialogOpen || !!assistantToEdit || !!contactManagerAssistant
  );

  // --- Voice Options  ---
  const hireFormNationality = formMethods.watch('nationality');
  const preferredLanguage = React.useMemo(
    () => getLangCodeForNationality(hireFormNationality),
    [hireFormNationality]
  );
  const allDisplayableVoices = React.useMemo(() => {
    const filteredByProvider = unsortedVoices.filter((v) => v.provider !== 'openai');

    const sorted = [...filteredByProvider];
    sorted.sort((a, b) => {
      const isAPreferred = preferredLanguage && a.language === preferredLanguage;
      const isBPreferred = preferredLanguage && b.language === preferredLanguage;
      if (isAPreferred && !isBPreferred) return -1;
      if (!isAPreferred && isBPreferred) return 1;
      if (!a.isPreset && b.isPreset) return -1;
      if (a.isPreset && !b.isPreset) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    return sorted;
  }, [unsortedVoices, preferredLanguage]);

  // --- Callbacks for UI interaction ---
  // Track whether we need to auto-select a preset when presets become available
  const [needsPresetSelection, setNeedsPresetSelection] = React.useState(false);
  const [userHasChangedPreset, setUserHasChangedPreset] = React.useState(false);

  const handleOpenHireDialog = React.useCallback(() => {
    resetHireFormInternal();
    setIsAssistantPresetsOpen(true);
    setPresetAgeFilter('all');
    setPresetNationalityFilter('all');
    setPresetGenderFilter('all');
    setPresetLanguageFilter('all');
    setIsDialogBusyProcessingVoice(false);

    // Mark that we need to select a preset once they're loaded
    setNeedsPresetSelection(true);
    setUserHasChangedPreset(false);

    // Open the dialog - this triggers lazy loading of presets
    setIsHireDialogOpen(true);
  }, [
    resetHireFormInternal,
    setPresetAgeFilter,
    setPresetNationalityFilter,
    setPresetGenderFilter,
    setPresetLanguageFilter,
  ]);

  // Auto-select the first filtered preset (top of the "Available Hires" list)
  // whenever the filtered list changes (e.g. the async geo lookup narrows by
  // region) — but only while the dialog is freshly opened and the user hasn't
  // manually picked a preset yet.
  // If a preset is already selected and still exists in the new filtered list
  // (e.g. after geo narrows the list), skip re-selection to avoid a visual
  // "reload" where photos/videos are cleared and re-fetched.
  React.useEffect(() => {
    if (needsPresetSelection && currentFilteredPresets.length > 0 && !userHasChangedPreset) {
      const current = formMethods.getValues('currentPreset');
      if (
        current &&
        currentFilteredPresets.some(
          (p) => p.firstName === current.firstName && p.surname === current.surname
        )
      ) {
        return; // already selected and still valid — nothing to do
      }
      selectPresetForHireForm(currentFilteredPresets[0]);
    }
  }, [
    needsPresetSelection,
    currentFilteredPresets,
    userHasChangedPreset,
    selectPresetForHireForm,
    formMethods,
  ]);

  const handleOpenEditDialog = React.useCallback(
    (assistant: Assistant) => {
      loadAssistantForEdit(assistant);
      setAssistantToEdit(assistant);
    },
    [loadAssistantForEdit]
  );

  const handleOpenContactManager = (assistant: Assistant, tab: ContactType = 'email') => {
    loadAssistantForEdit(assistant);
    setContactManagerInitialTab(tab);
    setContactManagerAssistant(assistant);
  };

  const handleOpenWorkspaceManager = (assistant: Assistant) => {
    loadAssistantForEdit(assistant);
    setWorkspaceManagerAssistant(assistant);
  };

  const handleRandomizePreset = () => {
    if (currentFilteredPresets.length === 0) {
      toast.info('No presets match filters.');
      return;
    }
    setUserHasChangedPreset(true);
    const randomIndex = Math.floor(Math.random() * currentFilteredPresets.length);
    selectPresetForHireForm(currentFilteredPresets[randomIndex]);
  };

  const handleUserPresetSelect = React.useCallback(
    (preset: AssistantPreset) => {
      setUserHasChangedPreset(true);
      selectPresetForHireForm(preset);
    },
    [selectPresetForHireForm]
  );

  const handleDeleteVoice = async (voice: VoiceOption) => {
    const deletedId = await deleteUserVoice(voice);
    if (deletedId) {
      setJustDeletedVoiceId(deletedId); // Set state to trigger the effect
    }
  };

  // Profile Panel Actions
  const onDeleteAssistantSubmit = async (assistant: Assistant) => {
    const success = await deleteAssistant(assistant);
    if (success) {
      handleProfileClose();
    } else {
      throw new Error('Deletion failed in hook.');
    }
  };

  // --- Effects ---
  const initialAssistantLoadProcessedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isBillingLoading && !isLoadingAssistants && !initialAssistantLoadProcessedRef.current) {
      initialAssistantLoadProcessedRef.current = true;
      // Don't auto-open the hire dialog when:
      // - MFA setup is required (the MFA enforcement modal needs focus)
      // - The user doesn't have hire permission (org members/admins can't hire)
      if (
        !assistantError &&
        assistants.length === 0 &&
        !isHireDialogOpen &&
        !userMeta.mfaSetupRequired &&
        canHire
      ) {
        handleOpenHireDialog();
      }
    }
  }, [
    assistants,
    isLoadingAssistants,
    assistantError,
    handleOpenHireDialog,
    isBillingLoading,
    isHireDialogOpen,
    userMeta.mfaSetupRequired,
    canHire,
  ]);
  React.useEffect(() => {
    if (justDeletedVoiceId) {
      const { getValues, setValue } = formMethods;
      if (getValues('voiceId') === justDeletedVoiceId) {
        setValue('voiceId', null as any);
        setValue('voiceName', '');
        setValue('voiceDescription', '');
        setValue('voiceGender', 'female');
        setValue('voiceLanguage', 'en');
        setValue('voiceProvider', PRIMARY_VOICE_PROVIDER);
        setValue('voiceExists', false);
      }
      setJustDeletedVoiceId(null); // Reset the trigger
    }
  }, [justDeletedVoiceId, formMethods]);

  // --- Memoized values for props ---
  const profileAssistant = React.useMemo(
    () => assistants.find((a) => a.agentId === profileAssistantId) || null,
    [assistants, profileAssistantId]
  );

  // --- Setup roadmap derivations (live-derived from existing state) ---
  // Captured on local hires so the roadmap's "Show install
  // instructions" step can re-open the dialog with the right OS
  // without us having to round-trip through the form again.
  const [hireOsByAgentId, setHireOsByAgentId] = React.useState<Record<string, string>>({});
  // True iff the user has sent ≥1 message in the currently-profiled
  // assistant's chat — drives the "Say hi" sub-step completion.
  const profiledHasUserMessage = React.useMemo(() => {
    if (!profileAssistantId) return false;
    const messages = profileChatHistories[profileAssistantId] ?? [];
    return messages.some((m) => m.role === 'user');
  }, [profileChatHistories, profileAssistantId]);
  // Latest user-message timestamp for the currently-profiled assistant.
  // Drives the "Ask in chat" prefill steps' done detection: those steps
  // are marked complete when the user sends a message after clicking
  // the prefill (timestamp > clickedAt). Computed per-render but cheap
  // since chat histories are already indexed in memory.
  const profiledLatestUserMessageAt = React.useMemo<Date | null>(() => {
    if (!profileAssistantId) return null;
    const messages = profileChatHistories[profileAssistantId] ?? [];
    let latest: Date | null = null;
    for (const m of messages) {
      if (m.role !== 'user') continue;
      if (!latest || m.timestamp.getTime() > latest.getTime()) latest = m.timestamp;
    }
    return latest;
  }, [profileChatHistories, profileAssistantId]);
  // True iff this assistant has any historical call recorded — drives
  // the roadmap's "Start a voice call" sub-step. Pulled from the
  // existing call-pill cache so we don't duplicate fetches.
  const profiledHasHistoricalCall = React.useMemo(() => {
    if (!profileAssistantId) return false;
    return (callPillHistories[profileAssistantId] ?? []).length > 0;
  }, [callPillHistories, profileAssistantId]);
  // True iff the logged-in user has a phone number on their profile —
  // gates the "Add phone to profile" roadmap step.
  const hasUserPhoneNumber = !!(userMeta.phoneNumber && userMeta.phoneNumber.trim() !== '');

  // Cross-assistant onboarding summaries — drives the "needs
  // attention" dot on each assistant list row. We pre-bake the
  // per-assistant chat / call ctx maps from the same caches the
  // single-assistant panel reads, so the badge can never disagree
  // with what the user sees inside the panel.
  //
  // For non-profiled assistants we have no in-memory chat history
  // (transcripts haven't been loaded), which means `hasUserMessage`
  // is `false` for them — leading to a "Say hi" outstanding step
  // and therefore a dot. That's actually the desired behavior: if
  // we've never even loaded that assistant's chat, the user almost
  // certainly hasn't onboarded them. We accept the small cost of
  // showing a dot until the user opens the assistant once
  // (transcripts then load and the panel resolves the state).
  const perAssistantChatCtx = React.useMemo<
    Record<string, { hasUserMessage: boolean; latestUserMessageAt: Date | null }>
  >(() => {
    const out: Record<string, { hasUserMessage: boolean; latestUserMessageAt: Date | null }> = {};
    for (const [agentId, msgs] of Object.entries(profileChatHistories)) {
      let latest: Date | null = null;
      let hasUser = false;
      for (const m of msgs) {
        if (m.role !== 'user') continue;
        hasUser = true;
        if (!latest || m.timestamp.getTime() > latest.getTime()) latest = m.timestamp;
      }
      out[agentId] = { hasUserMessage: hasUser, latestUserMessageAt: latest };
    }
    return out;
  }, [profileChatHistories]);
  const perAssistantCallCtx = React.useMemo<Record<string, { hasHistoricalCall: boolean }>>(() => {
    const out: Record<string, { hasHistoricalCall: boolean }> = {};
    for (const [agentId, pills] of Object.entries(callPillHistories)) {
      out[agentId] = { hasHistoricalCall: pills.length > 0 };
    }
    return out;
  }, [callPillHistories]);
  const onboardingSummaries = useAssistantOnboardingSummaries({
    assistants,
    currentUserId,
    hasUserPhoneNumber,
    perAssistantChat: perAssistantChatCtx,
    perAssistantCalls: perAssistantCallCtx,
  });
  // Flattened `{ agentId: hasOutstanding }` for the list — keeps the
  // list-level prop dead simple and avoids leaking summary internals
  // (totalSteps etc.) to a component that only needs a yes/no.
  const onboardingIncompleteByAgentId = React.useMemo<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const [agentId, summary] of Object.entries(onboardingSummaries)) {
      if (summary?.hasOutstanding) out[agentId] = true;
    }
    return out;
  }, [onboardingSummaries]);
  // The setup roadmap is the *owner's* checklist — the contact
  // details, integrations, install steps etc. all belong to whoever
  // hired the assistant. Org admins / collaborators viewing a
  // teammate's assistant get the bare Contact Info layout instead;
  // they have no actionable steps to tick off here.
  const isAssistantOwner =
    !!profileAssistant && !!currentUserId && profileAssistant.userId === currentUserId;
  // Open the local-install instructions dialog from the setup roadmap.
  // Falls back to a sane default if we don't have an OS captured (e.g.
  // the assistant was hired in a previous session before this feature
  // shipped).
  const handleShowInstallInstructions = React.useCallback(
    (assistant: Assistant) => {
      const os = hireOsByAgentId[assistant.agentId] || 'ubuntu';
      setSetupInstructions({ os, isOpen: true });
    },
    [hireOsByAgentId]
  );
  // Open the user's account settings in a new tab so the chat session
  // isn't disrupted while they configure their profile. Optional `tab`
  // mirrors the /account page's `?tab=` param (see ProfileTabs) so
  // callers can deep-link straight to the relevant section — e.g. the
  // "Add phone to profile" step lands on Contact Info directly.
  //
  // We also stamp a localStorage flag so the focus-refresh effect
  // below knows the user might have just changed something on their
  // profile — refreshing server data on every focus event is
  // wasteful, but doing so after an account-page round-trip ensures
  // derivations like `hasUserPhoneNumber` reflect the edit without
  // a manual reload.
  const router = useRouter();
  const handleOpenUserSettings = React.useCallback((tab?: string) => {
    if (typeof window === 'undefined') return;
    const url = tab ? `/account?tab=${encodeURIComponent(tab)}` : '/account';
    try {
      window.localStorage.setItem('console:assistants:user-settings-opened-at', String(Date.now()));
    } catch {
      /* private mode / quota — refresh just won't trigger */
    }
    window.open(url, '_blank', 'noopener');
  }, []);
  // Refresh server data (re-pulls userMeta) when the window regains
  // focus AFTER the user opened account settings. Gated on the flag
  // + a sane TTL so we don't trigger expensive RSC re-renders on
  // every alt-tab — only after an account-edit round-trip.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const FLAG_KEY = 'console:assistants:user-settings-opened-at';
    const TTL_MS = 10 * 60 * 1000;
    const onFocus = () => {
      let openedAt: number | null = null;
      try {
        const raw = window.localStorage.getItem(FLAG_KEY);
        openedAt = raw ? Number(raw) : null;
      } catch {
        return;
      }
      if (!openedAt || Number.isNaN(openedAt)) return;
      try {
        window.localStorage.removeItem(FLAG_KEY);
      } catch {
        /* ignore */
      }
      if (Date.now() - openedAt > TTL_MS) return;
      router.refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [router]);

  const activeCallId = activeCallAssistant?.agentId || popOutCallAssistantId;

  // --- System error listener (assistant-level, above all interaction surfaces) ---
  useAssistantSystemErrors(profileAssistant);

  // Determine active panel for width calculations
  const isFirstViewAfterHire = newlyHiredInfo?.assistant.agentId === profileAssistantId;
  const computedListWidth = isAssistantListFolded ? LIST_MIN_WIDTH : assistantListWidth;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AssistantsBanners
        credits={credits}
        isBillingLoading={isBillingLoading}
        spendingGateStatus={spendingGateStatus}
        isOrgWorkspace={!!userMeta.orgId}
        isFreeTrial={!!userMeta.isFreeTrial}
        accountStatus={accountStatus}
        billingMode={billingMode}
      />

      {/* StripeSidePanel — for adding payment method */}
      <StripeSidePanel
        open={isStripePanelOpen}
        onOpenChange={setIsStripePanelOpen}
        onSuccess={() => {
          // Kick off aggressive polling (every 2 s) to bridge the gap
          // between Stripe confirming payment and the webhook crediting
          // the balance.  Polling auto-stops once credits appear or
          // after 30 s.
          refetchBillingStatus();
          startBillingPolling();
          // Auto-claim pending credit grant token after payment method added
          if (pendingToken) {
            claimPendingToken();
          }
        }}
        pendingCreditToken={pendingToken}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        {/* Assistant List */}
        <div
          className="relative h-full flex-shrink-0 border-r"
          style={{
            width: computedListWidth,
            transition: isResizingList ? 'none' : 'width 0.3s ease-in-out',
          }}
        >
          <AssistantList
            assistants={assistants}
            assistantStatuses={assistantStatuses}
            assistantError={assistantError}
            isLoading={isLoadingAssistants}
            error={assistantError}
            profileAssistantId={profileAssistantId}
            onShowProfile={handleShowProfile}
            onOpenHireDialog={handleOpenHireDialog}
            onOpenContactManager={handleOpenContactManager}
            onOpenWorkspaceManager={handleOpenWorkspaceManager}
            onEditAssistant={handleOpenEditDialog}
            onEndContract={onDeleteAssistantSubmit}
            canEndContract={canDelete}
            canEditAssistant={canWrite}
            isFolded={isAssistantListFolded}
            activeCallAssistantId={activeCallId}
            onHangUp={handleHangUp}
            canHire={canHire}
            onToggleFold={handleToggleListFold}
            unreadCounts={chatStreamUnreadCounts}
            spacesById={spacesById}
          />
        </div>
        {/* List resize handle */}
        <div
          onMouseDown={handleListResizeStart}
          className="hover:bg-primary/20 active:bg-primary/40 -ml-1.5 h-full w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors duration-200"
          style={{ zIndex: 20 }}
        />

        {/* Right Pane: Chat + Actions + Dashboards */}
        <div className="relative h-full min-w-0 flex-1 overflow-hidden bg-background">
          <RightPaneContainer
            assistant={profileAssistant}
            actions={assistantActions.actions || null}
            dashboardActions={assistantActions.dashboards || null}
            assistantActions={assistantActions}
            chatHistories={profileChatHistories}
            setChatHistories={setProfileChatHistories}
            callPillHistories={callPillHistories}
            setCallPillHistories={setCallPillHistories}
            userEmail={userMeta.email}
            isFirstView={isFirstViewAfterHire}
            preHireChat={isFirstViewAfterHire ? newlyHiredInfo?.preHireChat : undefined}
            onFirstViewCompleted={handleFirstViewCompleted}
            onStartCall={handleStartCall}
            activeCallAssistantId={activeCallId}
            isCallConnected={isCallConnected}
            isConnectingCall={isConnectingCall}
            userTimezone={userMeta.timezone}
            canWrite={profileAssistant ? canWrite(profileAssistant) : undefined}
            spendingGate={spendingGateStatus}
            chatStreamConnectionStatus={
              profileAssistant
                ? (chatStreamConnectionStatusByAssistant[profileAssistant.agentId] ?? 'connecting')
                : 'connecting'
            }
            reconnectChatStream={reconnectChatStream}
            chatStreamActivitySignal={profileChatActivitySignal}
            paneState={paneState}
            onPaneStateChange={setPaneState}
            onEditAssistant={handleOpenEditDialog}
            onOpenContactManager={handleOpenContactManager}
            hasUserMessage={profiledHasUserMessage}
            hasHistoricalCall={profiledHasHistoricalCall}
            hasUserPhoneNumber={hasUserPhoneNumber}
            latestUserMessageAt={profiledLatestUserMessageAt}
            userPhoneNumber={userMeta.phoneNumber}
            // The roadmap activates downstream only when BOTH of the
            // owner-only handlers are provided (see ChatWithInfoPanel
            // — it gates the `roadmap` prop bag on their presence).
            // Withholding them for non-owners cleanly hides the
            // Onboarding tab without bespoke prop drilling.
            onShowInstallInstructions={isAssistantOwner ? handleShowInstallInstructions : undefined}
            onOpenUserSettings={isAssistantOwner ? handleOpenUserSettings : undefined}
            // Drives the dot on the chat header's "Assistant info"
            // button. Pulled from the same cross-assistant summary
            // map we used for the (now-removed) list-item dot, so
            // the source of truth doesn't fork.
            unreadChatCount={
              profileAssistant ? (chatStreamUnreadCounts[profileAssistant.agentId] ?? 0) : 0
            }
            hasIncompleteOnboarding={
              isAssistantOwner && profileAssistant
                ? !!onboardingIncompleteByAgentId[profileAssistant.agentId]
                : false
            }
          />
        </div>
      </div>

      {/* Dialogs and Overlays */}
      <FormProvider {...formMethods}>
        <AssistantHire
          formMethods={formMethods}
          isHireDialogOpen={isHireDialogOpen}
          isHireSubmitting={isFormSubmitting}
          setIsHireDialogOpen={setIsHireDialogOpen}
          isAssistantPresetsOpen={isAssistantPresetsOpen}
          setIsAssistantPresetsOpen={setIsAssistantPresetsOpen}
          handleRandomizePreset={handleRandomizePreset}
          currentFilteredPresets={currentFilteredPresets}
          onHireAttempt={initiateHireSequence}
          isProcessingPhoto={isDialogBusyProcessingPhoto}
          isProcessingVoice={isDialogBusyProcessingVoice}
          isCheckingBalance={isCheckingBalance}
          showInsufficientFundsHint={showInsufficientFundsHint}
          setShowInsufficientFundsHint={setShowInsufficientFundsHint}
          onAddPaymentMethod={() => setIsStripePanelOpen(true)}
          isStripePanelOpen={isStripePanelOpen}
        >
          <HireForm
            formMethods={formMethods}
            isSubmitting={isFormSubmitting}
            assistantActions={assistantActions}
            onPhotoProcessingStateChange={setIsDialogBusyProcessingPhoto}
            onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice}
            allDisplayableVoices={allDisplayableVoices}
            isLoadingUserVoices={isLoadingUserVoices}
            fetchUserVoices={fetchUserVoices}
            handleDeleteVoice={handleDeleteVoice}
            onNewMediaReady={onNewMediaReady}
            mode="hire"
            onAddPaymentMethod={() => setIsStripePanelOpen(true)}
            userHasChangedPreset={userHasChangedPreset}
          />
          <PresetsPanel
            displayedPresets={displayedPresets}
            onPresetSelect={handleUserPresetSelect}
            onClose={() => setIsAssistantPresetsOpen(false)}
            onLoadMore={loadMorePresets}
            canLoadMore={canLoadMorePresets}
            isLoadingMore={isLoadingMorePresets}
            ageFilter={presetAgeFilter}
            onAgeFilterChange={setPresetAgeFilter}
            availableAgeBrackets={availableAgeBrackets}
            nationalityFilter={presetNationalityFilter}
            onNationalityFilterChange={setPresetNationalityFilter}
            availableNationalities={availableNationalities}
            genderFilter={presetGenderFilter}
            onGenderFilterChange={setPresetGenderFilter}
            availableGenders={availableGenders}
            languageFilter={presetLanguageFilter}
            onLanguageFilterChange={setPresetLanguageFilter}
            availableLanguages={availableLanguages}
            layoutMode="split" // Dummy prop
            setLayoutMode={() => {}} // Dummy prop
            presetPhotoUrls={presetPhotoUrls}
          />
        </AssistantHire>

        {assistantToEdit && (
          <AssistantEdit
            isOpen={!!assistantToEdit}
            onClose={() => setAssistantToEdit(null)}
            assistant={assistantToEdit}
            formMethods={formMethods}
            onSubmit={initiateUpdate}
            isSubmitting={isFormSubmitting}
            isProcessingPhoto={isDialogBusyProcessingPhoto}
            isProcessingVoice={isDialogBusyProcessingVoice}
            onAddPaymentMethod={() => setIsStripePanelOpen(true)}
            isStripePanelOpen={isStripePanelOpen}
            onDeleteAssistant={onDeleteAssistantSubmit}
            canDelete={canDelete(assistantToEdit)}
          >
            <HireForm
              formMethods={formMethods}
              onSubmit={initiateUpdate}
              isSubmitting={isFormSubmitting}
              assistantActions={assistantActions}
              onPhotoProcessingStateChange={setIsDialogBusyProcessingPhoto}
              onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice}
              allDisplayableVoices={allDisplayableVoices}
              isLoadingUserVoices={isLoadingUserVoices}
              fetchUserVoices={fetchUserVoices}
              handleDeleteVoice={handleDeleteVoice}
              onNewMediaReady={onNewMediaReady}
              mode="edit"
              onAddPaymentMethod={() => setIsStripePanelOpen(true)}
            />
          </AssistantEdit>
        )}
        {contactManagerAssistant && (
          <AssistantContactManager
            isOpen={!!contactManagerAssistant}
            onClose={() => setContactManagerAssistant(null)}
            assistant={contactManagerAssistant}
            assistantActions={assistantActions}
            onSuccess={handleUpdateSuccess}
            initialTab={contactManagerInitialTab}
            canWrite={canWrite(contactManagerAssistant)}
            onAddPaymentMethod={() => setIsStripePanelOpen(true)}
            onOpenWorkspaceManager={(a) => {
              // Email tab CTA — close ContactManager and open the
              // Workspace modal as a sibling.
              setContactManagerAssistant(null);
              handleOpenWorkspaceManager(a);
            }}
            userPhoneNumber={userMeta.phoneNumber ?? null}
            userWhatsappNumber={userMeta.whatsappNumber ?? null}
            userDiscordId={userMeta.discordId ?? null}
            slackOwner={userMeta.slackOwner ?? null}
            slackCanManageInstall={userMeta.slackCanManageInstall ?? false}
            slackInitialInstall={userMeta.slackInitialInstall ?? null}
          />
        )}
        {workspaceManagerAssistant && (
          <AssistantWorkspaceManager
            isOpen={!!workspaceManagerAssistant}
            onClose={() => setWorkspaceManagerAssistant(null)}
            assistant={workspaceManagerAssistant}
            assistantActions={assistantActions}
            onSuccess={handleUpdateSuccess}
            canWrite={canWrite(workspaceManagerAssistant)}
          />
        )}
      </FormProvider>

      <AssistantHireLocalSetupInstructionsDialog
        isOpen={setupInstructions?.isOpen || false}
        os={setupInstructions?.os || 'ubuntu'}
        onClose={() => setSetupInstructions(null)}
      />

      {activeCallAssistant && (
        <RoomContext.Provider value={room}>
          <AssistantCommunicationDialog
            isOpen={isCommunicationDialogOpen}
            onClose={handleHangUp}
            assistant={activeCallAssistant}
            assistantActions={assistantActions}
            room={room}
            chatHistories={profileChatHistories}
            setChatHistories={setProfileChatHistories}
            callPillHistories={callPillHistories}
            setCallPillHistories={setCallPillHistories}
            isConnecting={isConnectingCall}
            userEmail={userMeta.email}
            userImage={userMeta.image}
            isWaitingForAssistant={isWaitingForAssistant}
            waitingMessage={waitingMessage}
            isCallConnected={isCallConnected}
            connectionError={connectionError}
            onRetry={retryConnection}
            isRemoteControlActive={isRemoteControlActive}
            liveviewUrl={liveviewUrl}
            isRemoteControlLoading={isRemoteControlLoading}
            toggleRemoteControl={toggleRemoteControl}
            isRemoteControlInteractive={isRemoteControlInteractive}
            isRemoteControlInteractiveLoading={isRemoteControlInteractiveLoading}
            toggleRemoteControlInteractive={toggleRemoteControlInteractive}
            isDesktopReady={isDesktopReady}
            callType={callType}
            isSpeakerMuted={isSpeakerMuted}
            onToggleSpeaker={toggleSpeakerMute}
            chatStreamConnectionStatus={
              chatStreamConnectionStatusByAssistant[activeCallAssistant.agentId] ?? 'connecting'
            }
            reconnectChatStream={reconnectChatStream}
            chatStreamActivitySignal={chatActivityCounters[activeCallAssistant.agentId] ?? 0}
          />
        </RoomContext.Provider>
      )}
    </div>
  );
}
