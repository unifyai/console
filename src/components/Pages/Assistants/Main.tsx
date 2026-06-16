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
  AssistantCallConnectOptions,
  AssistantFormData,
  AssistantPreset,
  AssistantUpdatePayload,
  VoiceOption,
} from '@/types/assistants/assistant';
import { ContactType, type OAuthProvider } from '@/types/assistants/contact';
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
import { useReferralCapture } from '@/hooks/Billing/useReferralCapture';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';
import { useBillingEvents } from '@/hooks/Billing/useBillingEvents';
import { AssistantsBanners } from './AssistantsBanners';
import { useAssistantStatus } from '@/hooks/Assistants/useAssistantStatus';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { useAssistantOnboardingSummaries } from '@/hooks/Assistants/useAssistantOnboardingSummaries';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormProvider } from 'react-hook-form';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import {
  type CoordinatorWorkspaceScope,
  resolveCanonicalWorkspaceCoordinator,
} from '@/lib/assistants/coordinatorIdentity';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import {
  CoordinatorOnboardingProvider,
  type CoordinatorOnboardingContextValue,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingContext';
import {
  CoordinatorOnboarding,
  CoordinatorTalkNowCue,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboarding';
import {
  hasOutstandingCoordinatorOnboarding,
  type ChecklistAction,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingChecklist';
import { subscribeOAuthComplete } from '@/utils/assistants/oauth';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage, CallPill } from '@/types/assistants/chat';
import { AssistantDesktopLinker } from './Profile/AssistantDesktopLinker';
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
import { useAssistantPresenceWake } from '@/hooks/Assistants/useAssistantPresenceWake';
import { seedMediaSignedUrls } from '@/lib/client/assistant';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';
import { createRandomDroidProfile } from '@/utils/assistants/droid-profile-randomizer';

const ENABLE_COORDINATOR_ONBOARDING = true;

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

function buildTeamsById(assistants: readonly Assistant[]): Record<number, SharedTeamSummary> {
  const teamsById: Record<number, SharedTeamSummary> = {};
  for (const assistant of assistants) {
    for (const summary of assistant.teamSummaries ?? []) {
      teamsById[summary.teamId] = summary;
    }
    for (const teamId of assistant.teamIds ?? []) {
      if (!teamsById[teamId]) {
        teamsById[teamId] = {
          teamId,
          name: `Team ${teamId}`,
          description: null,
        };
      }
    }
  }
  return teamsById;
}

function isSignedMediaUrl(url: string | null | undefined): url is string {
  return Boolean(url && (url.startsWith('https://') || url.startsWith('http://')));
}

export default function Main({ assistantActions, userMeta }: MainProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileParam = searchParams.get('profile');
  const { activeWorkspace, currentUserId } = useWorkspace();
  // Workspace connect (Gmail/Outlook BYOD) needs an OAuth client configured on
  // the deployment. When neither provider is available, the onboarding
  // "Connect workspace" step is suppressed rather than leading to a dead end.
  const { workspaceGoogle, workspaceMicrosoft } = useFeatures();
  const workspaceConnectAvailable = workspaceGoogle || workspaceMicrosoft;
  const coordinatorWorkspace = React.useMemo<CoordinatorWorkspaceScope>(() => {
    if (activeWorkspace?.type === 'organization') {
      const parsedOrganizationId = Number.parseInt(activeWorkspace.id, 10);
      return {
        type: 'organization',
        organizationId: Number.isFinite(parsedOrganizationId) ? parsedOrganizationId : null,
      };
    }
    return { type: 'personal', organizationId: null };
  }, [activeWorkspace?.id, activeWorkspace?.type]);

  const syncProfileQueryParam = React.useCallback(
    (assistantId: string | null) => {
      if (typeof window === 'undefined') return;

      const currentProfile = searchParams.get('profile');
      if ((assistantId ?? null) === (currentProfile ?? null)) return;

      const nextParams = new URLSearchParams(searchParams.toString());
      if (assistantId) {
        nextParams.set('profile', assistantId);
      } else {
        nextParams.delete('profile');
      }

      const nextQuery = nextParams.toString();
      const nextUrl =
        nextQuery.length > 0
          ? `${window.location.pathname}?${nextQuery}`
          : window.location.pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [router, searchParams]
  );

  // --- UI Panel Management ---
  const {
    profileAssistantId,
    handleShowProfile: setPanelProfileAssistant,
    handleProfileClose: clearPanelProfileAssistant,
  } = usePanelManager(profileParam);
  useAssistantPresenceWake(profileAssistantId);
  const handleShowProfile = React.useCallback(
    (assistantId: string) => {
      setPanelProfileAssistant(assistantId);
      syncProfileQueryParam(assistantId);
    },
    [setPanelProfileAssistant, syncProfileQueryParam]
  );
  const handleProfileClose = React.useCallback(() => {
    clearPanelProfileAssistant();
    syncProfileQueryParam(null);
  }, [clearPanelProfileAssistant, syncProfileQueryParam]);
  const handleAssistantListSelect = React.useCallback(
    (assistantId: string) => {
      if (assistantId === profileAssistantId) {
        handleProfileClose();
        return;
      }

      handleShowProfile(assistantId);
    },
    [handleProfileClose, handleShowProfile, profileAssistantId]
  );

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
    setPaneState((prev) => ({
      ...prev,
      primary: { tab: 'chat' },
      secondary: null,
    }));
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
  } = useAssistants(assistantActions, coordinatorWorkspace, currentUserId);

  // --- Assistant Permissions ---
  const { canHire, canWrite, canEndContract, canOpenAssistantChat } = useAssistantPermissions();
  const sidebarAssistants = React.useMemo(
    () => assistants.filter((assistant) => canOpenAssistantChat(assistant)),
    [assistants, canOpenAssistantChat]
  );
  const chatReadableAssistants = sidebarAssistants;

  const teamsById = React.useMemo(() => buildTeamsById(sidebarAssistants), [sidebarAssistants]);

  const canonicalCoordinator = React.useMemo(
    () => resolveCanonicalWorkspaceCoordinator(assistants, currentUserId, coordinatorWorkspace),
    [assistants, coordinatorWorkspace, currentUserId]
  );
  const canonicalCoordinatorId = canonicalCoordinator?.agentId ?? null;

  // Coordinator onboarding intro gate: on a fresh ``onboarding`` visit
  // (``mode === 'onboarding'`` and the intro hasn't been watched yet) we
  // overlay the call-vs-chat picker + animated intro on top of the
  // regular /assistants shell. The layout itself never swaps — once the
  // overlay dismisses the user is in the full platform with the
  // onboarding checklist in the Coordinator's "Assistant info" panel.
  //
  // The hook is enabled the moment a canonical coordinator is resolvable
  // — non-owner viewers of an org workspace fall through with
  // ``state === null`` because the backend rejects their read of the
  // state row, which keeps the intro gate ``false``.
  const isCanonicalCoordinatorOwned =
    !!canonicalCoordinator && !!currentUserId && canonicalCoordinator.userId === currentUserId;
  const {
    state: coordinatorOnboardingState,
    isLoading: isCoordinatorOnboardingStateLoading,
    refetch: refetchCoordinatorOnboardingState,
    updateState: updateCoordinatorOnboardingState,
  } = useCoordinatorOnboarding(canonicalCoordinatorId, {
    enabled: isCanonicalCoordinatorOwned && ENABLE_COORDINATOR_ONBOARDING,
  });
  // Session flag flipped once the overlay is resolved this session, so it
  // doesn't pop back in after the intro finishes (the ``intro_watched``
  // write is async + optimistic, but this keeps the dismissal instant).
  const [coordinatorIntroDismissed, setCoordinatorIntroDismissed] = React.useState(false);
  // On-demand "Repeat intro" replays the intro overlay regardless of
  // ``intro_watched`` — driven from the Coordinator's "Assistant info"
  // onboarding tab. It mounts the overlay straight into the intro
  // (skipping the picker) and clears itself once the intro finishes.
  const [coordinatorIntroReplay, setCoordinatorIntroReplay] = React.useState(false);
  // "Talk now!" cue lifecycle. The intro overlay tears down when it hands
  // off to the call, so the cue lives here (over the docked call): the
  // intro completing via the call path arms it, and it fires once the
  // Coordinator's call actually connects so the user isn't told to talk
  // before Marty is listening.
  const [coordinatorTalkNowPending, setCoordinatorTalkNowPending] = React.useState(false);
  const [showCoordinatorTalkNow, setShowCoordinatorTalkNow] = React.useState(false);
  const showCoordinatorOnboardingFreshIntro =
    ENABLE_COORDINATOR_ONBOARDING &&
    isCanonicalCoordinatorOwned &&
    !coordinatorIntroDismissed &&
    coordinatorOnboardingState?.mode === 'onboarding' &&
    coordinatorOnboardingState?.introWatched === false;
  const showCoordinatorOnboardingIntro =
    showCoordinatorOnboardingFreshIntro || coordinatorIntroReplay;

  // Shared onboarding step progress for the Coordinator onboarding
  // flow. Lifted out of ``CoordinatorOnboarding`` so the same set
  // survives the gradual ↔ info-panel layout transition — the
  // Onboarding tab follows the user into the coordinator's assistant
  // info panel on the base /assistants shell.
  // ``'meet'`` is seeded because the picker is always resolved by
  // the time we render anything substantive; the durable steps
  // (workspace/apps/act/schedule) are seeded from the server-derived
  // ``completedStepIds`` on the Coordinator/State read (see the
  // effect below), so progress survives reloads without a separate
  // persisted copy.
  const [completedStepIds, setCompletedStepIds] = React.useState<ReadonlySet<string>>(
    () => new Set(['meet'])
  );
  const [skippedStepIds, setSkippedStepIds] = React.useState<ReadonlySet<string>>(() => new Set());
  // Engagement is a strict superset of completion — engaging
  // ``apps`` (clicking "Connect apps") unlocks the integrations
  // tab even though the row stays pending until a secret actually
  // lands. Completion always implies engagement, so
  // ``markStepCompleted`` below back-fills the engaged set too.
  const [engagedStepIds, setEngagedStepIds] = React.useState<ReadonlySet<string>>(
    () => new Set(['meet'])
  );
  const markStepCompleted = React.useCallback((stepId: string) => {
    setCompletedStepIds((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
    setEngagedStepIds((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);
  const markStepSkipped = React.useCallback((stepId: string) => {
    setSkippedStepIds((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
    setEngagedStepIds((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);
  const markStepUnskipped = React.useCallback((stepId: string) => {
    setSkippedStepIds((prev) => {
      if (!prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  }, []);
  const markStepEngaged = React.useCallback((stepId: string) => {
    setEngagedStepIds((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);
  // Optimistic: flip the local checklist state immediately so the
  // row resolves (and downstream rows unlock) on the same frame as
  // the click. The orchestra write happens in the background; we roll
  // the local state back if it fails (the hook surfaces its own error
  // toast). Awaiting the round-trip before updating made "Later" feel
  // multi-second-slow because the server action + DB write gated the
  // re-render.
  const handleCoordinatorOnboardingStepSkip = React.useCallback(
    async (stepId: string) => {
      markStepSkipped(stepId);
      const skipped = await updateCoordinatorOnboardingState({ skipOnboardingStep: stepId });
      if (!skipped) markStepUnskipped(stepId);
    },
    [markStepSkipped, markStepUnskipped, updateCoordinatorOnboardingState]
  );
  const handleCoordinatorOnboardingStepUnskip = React.useCallback(
    async (stepId: string) => {
      markStepUnskipped(stepId);
      const unskipped = await updateCoordinatorOnboardingState({ unskipOnboardingStep: stepId });
      if (!unskipped) markStepSkipped(stepId);
    },
    [markStepSkipped, markStepUnskipped, updateCoordinatorOnboardingState]
  );
  const coordinatorOnboardingCtxValue = React.useMemo<CoordinatorOnboardingContextValue>(
    () => ({
      completedStepIds,
      markStepCompleted,
      skippedStepIds,
      markStepSkipped,
      markStepUnskipped,
      engagedStepIds,
      markStepEngaged,
    }),
    [
      completedStepIds,
      markStepCompleted,
      skippedStepIds,
      markStepSkipped,
      markStepUnskipped,
      engagedStepIds,
      markStepEngaged,
    ]
  );
  // While the state read is still in flight we can't make a confident
  // layout choice: rendering the regular shell only to swap to the
  // onboarding view a moment later would flash the wrong UI in front
  // of users who just came back to a Coordinator still in onboarding.
  // We keep the main shell suspended for two distinct windows:
  //
  //   1. The assistants-list load — until that resolves we don't even
  //      know who the canonical coordinator is, so we can't dispatch
  //      to the onboarding hook with a stable id. Without this guard
  //      the regular shell renders briefly with empty data before the
  //      list lands and the onboarding gate flips on.
  //   2. The first read of the Coordinator/State row — once we know
  //      the user owns a coordinator, we wait on its state before
  //      committing to a layout.
  //
  // Subsequent transitions update the React Query cache synchronously
  // so neither branch fires again after the initial bootstrap.
  const isCoordinatorOnboardingResolvePending =
    ENABLE_COORDINATOR_ONBOARDING &&
    ((isLoadingAssistants && !canonicalCoordinator) ||
      (isCanonicalCoordinatorOwned &&
        coordinatorOnboardingState === null &&
        isCoordinatorOnboardingStateLoading));

  React.useEffect(() => {
    if (!profileAssistantId || isLoadingAssistants) return;
    const selectedAssistantStillVisible = assistants.some(
      (assistant) => assistant.agentId === profileAssistantId
    );
    if (selectedAssistantStillVisible) return;

    if (canonicalCoordinatorId) {
      handleShowProfile(canonicalCoordinatorId);
      return;
    }

    handleProfileClose();
  }, [
    assistants,
    canonicalCoordinatorId,
    handleProfileClose,
    handleShowProfile,
    isLoadingAssistants,
    profileAssistantId,
  ]);

  // Default landing selection: a bare ``/assistants`` visit (no
  // ``?profile=`` deep link) selects the workspace Coordinator and opens
  // its "Assistant info" card, regardless of onboarding state. A deep link
  // to an assistant takes precedence — the target is already selected when
  // it lands, so the coordinator is not forced on top of it.
  //
  // The "did the page land with a deep link?" decision is captured at mount
  // rather than read from the live ``profileAssistantId``. Assistant data
  // loads asynchronously, so this effect can fire after the user has already
  // interacted with the list. Reading live state here would let a deselect
  // performed during loading be clobbered by the coordinator reselection
  // once the data arrives.
  const landedWithProfileDeepLinkRef = React.useRef(profileParam != null);
  const defaultCoordinatorSelectionRef = React.useRef(false);
  React.useEffect(() => {
    if (defaultCoordinatorSelectionRef.current) return;
    if (isLoadingAssistants || !canonicalCoordinatorId) return;
    defaultCoordinatorSelectionRef.current = true;
    if (landedWithProfileDeepLinkRef.current) return;
    if (!profileAssistantId) {
      handleShowProfile(canonicalCoordinatorId);
    }
  }, [canonicalCoordinatorId, handleShowProfile, isLoadingAssistants, profileAssistantId]);

  // --- Assistant Status Polling ---
  const { statuses: assistantStatuses, markOnline: markAssistantOnline } =
    useAssistantStatus(assistants);

  // --- Billing Status & Credit Grant Link ---
  const {
    credits,
    accountStatus,
    billingMode,
    isBalanceKnown,
    isLoading: isBillingLoading,
    refetch: refetchBillingStatus,
    startPolling: startBillingPolling,
  } = useBillingStatus();
  useBillingEvents();
  // Auto-claims any pending credit-grant link token on mount (promo links).
  useCreditGrantLink();
  // Attributes a pending ?ref= referral code once the session is authenticated.
  useReferralCapture();

  // Self-serve depletion is a hard stop resolved on the Billing page
  // (upgrade a tier or enable auto-increment) — there is no in-app
  // one-time top-up flow anymore.
  //
  // Open Billing in a *new tab* so the user keeps their in-progress work on
  // this page (drafts, open dialogs, chat state) instead of navigating away
  // and losing it. This tab stays live-aware of the balance: it listens for
  // ``credits_restored`` SSE (useBillingEvents), refetches on window focus,
  // and we kick off aggressive short-interval polling here as a belt-and-
  // braces bridge — so once they subscribe in the other tab the
  // BillableActionGuard unblocks automatically, no reload required.
  const goToBilling = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    window.open('/billing', '_blank', 'noopener,noreferrer');
    startBillingPolling();
  }, [startBillingPolling]);

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
  const [workspaceManagerInitialProvider, setWorkspaceManagerInitialProvider] =
    React.useState<OAuthProvider | null>(null);
  const [hireWorkspaceProvider, setHireWorkspaceProvider] = React.useState<OAuthProvider | null>(
    null
  );
  // When no workspace provider is configured on the deployment there's nothing
  // to connect, so default to "skip" — otherwise the hire flow would block on a
  // step the user can't complete.
  const [skipHireWorkspaceSetup, setSkipHireWorkspaceSetup] =
    React.useState(!workspaceConnectAvailable);
  const [showHireWorkspaceWarning, setShowHireWorkspaceWarning] = React.useState(false);
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
    chatReadableAssistants,
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
    isAssistantPreparing,
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
    avatarMood,
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
      chatReadableAssistants
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
    [chatReadableAssistants, resolvedContactIds]
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
      // the badge to climb so the user notices), or, if no panel is
      // open, the call dialog's embedded side panel.
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
      chatReadableAssistants
        .map((a) => {
          const cid = resolvedContactIds[a.agentId];
          if (cid === undefined) return null;
          return { assistantId: a.agentId, contactId: cid, assistant: a };
        })
        .filter((p): p is TranscriptReconcilerPair => p !== null),
    [chatReadableAssistants, resolvedContactIds]
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

  // Assistant whose "Link your desktop" dialog is currently open. The linker
  // lets the owner connect their own machine and bundles the per-OS setup
  // instructions, replacing the old creation-time local-desktop flow.
  const [desktopLinkerAssistant, setDesktopLinkerAssistant] = React.useState<Assistant | null>(
    null
  );
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
    isBalanceKnown,
    billingMode,
    isFreeTrial: !!userMeta.isFreeTrial,
  });

  // Reset assistant spending when profile changes
  React.useEffect(() => {
    setProfileAssistantSpending(null);
  }, [profileAssistantId]);

  // ``isCommunicationDialogOpen`` doubles as the call-popped-out
  // flag now: ``false`` (the default) renders the call docked above
  // the chat panel, ``true`` lifts it back into the
  // floating/modal dialog overlay. The flag is reset to ``false`` on
  // hangup and on disconnect so the next call starts docked again.
  const handleStartCall = React.useCallback(
    async (
      assistant: Assistant,
      callType: 'video' | 'audio',
      options?: AssistantCallConnectOptions
    ) => {
      const activeCallId = activeCallAssistant?.agentId || popOutCallAssistantId;
      if (activeCallId) {
        if (activeCallId === assistant.agentId) {
          if (popOutCallAssistantId) {
            toast.info(
              'Call is active in a separate tab. Close that tab to start a new call here.'
            );
          }
          // Same-assistant re-click while a call is already running:
          // no-op — the docked surface is already on screen, and
          // popping it out shouldn't happen by accident.
        } else {
          toast.info('A call is already in progress with another assistant.');
        }
        return;
      }

      // Fresh call: stay docked by default.
      setIsCommunicationDialogOpen(false);
      await startCall(assistant, callType, options);
    },
    [startCall, activeCallAssistant, popOutCallAssistantId]
  );

  const handlePopOutCall = React.useCallback(() => {
    setIsCommunicationDialogOpen(true);
  }, []);
  const handleRedockCall = React.useCallback(() => {
    setIsCommunicationDialogOpen(false);
  }, []);

  const handleHangUp = React.useCallback(async () => {
    await hangUpCall();
    setIsCommunicationDialogOpen(false);
  }, [hangUpCall]);

  // Reset the popped-out flag if the call drops while popped out,
  // so the next call starts docked rather than surprise-popping the
  // user with a leftover overlay.
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
    setPresetAgeFilter,
    setPresetNationalityFilter,
    presetGenderFilter,
    setPresetGenderFilter,
    setPresetLanguageFilter,
    availableGenders,
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
        isCoordinator: newAssistant.isCoordinator ?? false,
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

      if (hireWorkspaceProvider) {
        setWorkspaceManagerInitialProvider(hireWorkspaceProvider);
        setWorkspaceManagerAssistant(optimisticAssistant);
        setHireWorkspaceProvider(null);
        setSkipHireWorkspaceSetup(false);
        setShowHireWorkspaceWarning(false);
      }

      refreshAssistants(false);
      fetchUserVoices();
      refetchBillingStatus();
    },
    [
      refreshAssistants,
      handleShowProfile,
      refetchBillingStatus,
      fetchUserVoices,
      setAssistants,
      hireWorkspaceProvider,
    ]
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

  const handleHireWorkspaceProviderSelect = React.useCallback((provider: OAuthProvider) => {
    setHireWorkspaceProvider(provider);
    setSkipHireWorkspaceSetup(false);
    setShowHireWorkspaceWarning(false);
  }, []);

  const handleSkipHireWorkspaceSetupChange = React.useCallback((skip: boolean) => {
    setSkipHireWorkspaceSetup(skip);
    if (skip) {
      setHireWorkspaceProvider(null);
      setShowHireWorkspaceWarning(false);
    }
  }, []);

  const handleHireAttempt = React.useCallback(async () => {
    if (workspaceConnectAvailable && !hireWorkspaceProvider && !skipHireWorkspaceSetup) {
      setShowHireWorkspaceWarning(true);
      return;
    }

    await initiateHireSequence();
  }, [
    workspaceConnectAvailable,
    hireWorkspaceProvider,
    initiateHireSequence,
    skipHireWorkspaceSetup,
  ]);

  // --- Voice Options  ---
  const allDisplayableVoices = React.useMemo(() => {
    const filteredByProvider = unsortedVoices.filter((v) => v.provider !== 'openai');

    const sorted = [...filteredByProvider];
    sorted.sort((a, b) => {
      if (!a.isPreset && b.isPreset) return -1;
      if (a.isPreset && !b.isPreset) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    return sorted;
  }, [unsortedVoices]);

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
    setHireWorkspaceProvider(null);
    // No configurable workspace provider → pre-skip so the flow isn't blocked.
    setSkipHireWorkspaceSetup(!workspaceConnectAvailable);
    setShowHireWorkspaceWarning(false);

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
    workspaceConnectAvailable,
  ]);

  const applyRandomDroidProfile = React.useCallback(() => {
    const profile = createRandomDroidProfile();
    formMethods.setValue('firstName', profile.firstName, { shouldValidate: true });
    formMethods.setValue('surname', profile.surname, { shouldValidate: true });
    formMethods.setValue('jobTitle', profile.jobTitle, { shouldValidate: true });
    formMethods.setValue('about', profile.about, { shouldValidate: true });
    formMethods.setValue('isPresetPristine', false);
  }, [formMethods]);

  // Auto-select the first filtered preset for hidden defaults like voice, then
  // Replace the visible profile fields with a branded droid profile.
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
      applyRandomDroidProfile();
    }
  }, [
    needsPresetSelection,
    currentFilteredPresets,
    userHasChangedPreset,
    selectPresetForHireForm,
    formMethods,
    applyRandomDroidProfile,
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
    setWorkspaceManagerInitialProvider(null);
    setWorkspaceManagerAssistant(assistant);
  };

  // Handler bag forwarded to the coordinator's assistant info
  // panel "Onboarding" sub-tab. ``connect-workspace`` is kept wired
  // as a defensive fallback in case a flow lets users reach the
  // info panel with that step still pending.
  //
  // ``connect-workspace`` here is engagement-only: clicking opens
  // the workspace manager but doesn't mark the step done. Real
  // completion is observed by the effect below that watches
  // ``canonicalCoordinator.email`` / ``.emailProvider`` landing.
  // Replays the Marty call intro on demand from the Coordinator's
  // "Assistant info" onboarding tab. Mounts the intro overlay straight
  // into the animation (no picker); it clears itself on finish.
  const handleReplayCoordinatorIntro = React.useCallback(() => {
    setCoordinatorIntroReplay(true);
  }, []);

  // Carries the gradual-onboarding "open the next surface" behaviour into
  // the info-panel checklist: a checklist row engages its step and
  // navigates the right pane's main slot to the matching tab
  // (Integrations / Actions / Tasks) so the user lands where the work
  // happens. The coordinator is already the selected profile while its
  // onboarding card is open, so the tab renders against it.
  const handleCoordinatorOpenPaneTab = React.useCallback(
    (tab: RightPaneTab, stepId: string) => {
      markStepEngaged(stepId);
      setPaneState((prev) => ({ ...prev, primary: { tab } }));
    },
    [markStepEngaged]
  );

  // Which checklist actions are available (wired) on this deployment.
  // Workspace OAuth needs a configured provider; the rest are always
  // reachable in the full platform. Mirrors the handler wiring below so
  // the outstanding-step signal and the rendered rows agree.
  const isCoordinatorActionWired = React.useCallback(
    (action: ChecklistAction | undefined): boolean => {
      if (action === 'connect-workspace') return workspaceConnectAvailable;
      if (action === 'connect-apps' || action === 'act' || action === 'schedule') return true;
      return false;
    },
    [workspaceConnectAvailable]
  );

  // Whether the Coordinator still has an actionable onboarding step left.
  // Drives the "Assistant info" nudge dot and the mobile auto-open so
  // both track the coordinator checklist (not the per-assistant roadmap).
  const coordinatorOnboardingOutstanding = React.useMemo(
    () =>
      isCanonicalCoordinatorOwned &&
      hasOutstandingCoordinatorOnboarding(
        completedStepIds,
        skippedStepIds,
        isCoordinatorActionWired
      ),
    [isCanonicalCoordinatorOwned, completedStepIds, skippedStepIds, isCoordinatorActionWired]
  );
  const isCoordinatorOnboardingFocusLayout =
    ENABLE_COORDINATOR_ONBOARDING &&
    isCanonicalCoordinatorOwned &&
    coordinatorOnboardingState?.mode === 'onboarding' &&
    coordinatorOnboardingOutstanding &&
    !showCoordinatorOnboardingIntro &&
    canonicalCoordinatorId !== null &&
    profileAssistantId === canonicalCoordinatorId &&
    (coordinatorIntroDismissed || coordinatorOnboardingState?.introWatched === true);

  // Apply the onboarding-focus rail layout once, on the edge where the
  // focus state turns on — this seeds the *default* (folded rail) without
  // locking it, so the user can re-expand the rail freely afterwards. The
  // ref resets when focus turns off so re-entering onboarding re-seeds it.
  const hasSeededCoordinatorFocusRailRef = React.useRef(false);
  React.useEffect(() => {
    if (!isCoordinatorOnboardingFocusLayout) {
      hasSeededCoordinatorFocusRailRef.current = false;
      return;
    }
    if (hasSeededCoordinatorFocusRailRef.current) return;
    hasSeededCoordinatorFocusRailRef.current = true;
    if (!isAssistantListFolded) {
      preSnapWidthRef.current = assistantListWidth;
    }
    setIsAssistantListFolded(true);
    setAssistantListWidth(LIST_MIN_WIDTH);
  }, [
    LIST_MIN_WIDTH,
    assistantListWidth,
    isAssistantListFolded,
    isCoordinatorOnboardingFocusLayout,
  ]);

  React.useEffect(() => {
    if (!isCoordinatorOnboardingFocusLayout) return;
    setPaneState((prev) =>
      prev.primary.tab === 'chat' && prev.secondary === null
        ? prev
        : {
            ...prev,
            primary: { tab: 'chat' },
            secondary: null,
          }
    );
  }, [isCoordinatorOnboardingFocusLayout]);

  const coordinatorOnboardingPanelHandlers = React.useMemo(() => {
    if (!isCanonicalCoordinatorOwned || !canonicalCoordinator) return undefined;
    // Live step completion is only meaningful while the Coordinator is
    // the selected profile — that's whose Integrations / Tasks / Actions
    // panes are mounted in the right pane. Gating ``onStepComplete`` on
    // this keeps another assistant's domain data from ticking off the
    // Coordinator's onboarding steps.
    const isProfileCoordinator = profileAssistantId === canonicalCoordinator.agentId;
    return {
      onConnectWorkspace: workspaceConnectAvailable
        ? () => {
            markStepEngaged('workspace');
            handleOpenWorkspaceManager(canonicalCoordinator);
          }
        : undefined,
      onConnectApps: () => handleCoordinatorOpenPaneTab('integrations', 'apps'),
      onActNow: () => handleCoordinatorOpenPaneTab('actions', 'act'),
      onScheduleTask: () => handleCoordinatorOpenPaneTab('tasks', 'schedule'),
      onSkipStep: handleCoordinatorOnboardingStepSkip,
      onUnskipStep: handleCoordinatorOnboardingStepUnskip,
      onReplayIntro: handleReplayCoordinatorIntro,
      onStepComplete: isProfileCoordinator ? markStepCompleted : undefined,
      // Flavours the "Ask Marty to do something" suggestion chips:
      // call-friendly prompts while on a voice call, chat-friendly
      // otherwise.
      isOnCall:
        !!activeCallAssistant && activeCallAssistant.agentId === canonicalCoordinator.agentId,
    };
    // ``handleOpenWorkspaceManager`` isn't a useCallback (defined
    // inline above) so it intentionally isn't in the deps — using
    // its stable identity across renders would require lifting it
    // to a ref, which is overkill for this rarely-reactive surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCanonicalCoordinatorOwned,
    canonicalCoordinator,
    profileAssistantId,
    activeCallAssistant,
    markStepEngaged,
    markStepCompleted,
    handleCoordinatorOpenPaneTab,
    handleCoordinatorOnboardingStepSkip,
    handleCoordinatorOnboardingStepUnskip,
    handleReplayCoordinatorIntro,
    workspaceConnectAvailable,
  ]);

  // Starts the Coordinator call from the onboarding intro. Selecting the
  // Coordinator first ensures the call docks into its right pane — the
  // normal docked-call path keys on the active call's assistant matching
  // the selected profile.
  const handleStartCoordinatorIntroCall = React.useCallback(
    (assistant: Assistant, type: 'video' | 'audio', options?: AssistantCallConnectOptions) => {
      handleShowProfile(assistant.agentId);
      return handleStartCall(assistant, type, options);
    },
    [handleShowProfile, handleStartCall]
  );

  // While the onboarding intro overlay is up, pin the canonical
  // Coordinator as the selected profile so that — whichever path the
  // user takes — the platform underneath is already showing the
  // Coordinator when the overlay clears (its chat, or the docked call
  // the intro warms up).
  React.useEffect(() => {
    if (!showCoordinatorOnboardingIntro || !canonicalCoordinatorId) return;
    if (profileAssistantId === canonicalCoordinatorId) return;
    handleShowProfile(canonicalCoordinatorId);
  }, [
    showCoordinatorOnboardingIntro,
    canonicalCoordinatorId,
    profileAssistantId,
    handleShowProfile,
  ]);

  // Fire the armed "Talk now!" cue once the onboarding intro's call
  // actually connects (a short beat after, so it lands as the droid
  // settles into the docked call rather than mid-connect).
  React.useEffect(() => {
    if (!coordinatorTalkNowPending) return;
    const coordinatorCallConnected =
      isCallConnected && activeCallAssistant?.agentId === canonicalCoordinatorId;
    if (!coordinatorCallConnected) return;
    const showHandle = window.setTimeout(() => {
      setShowCoordinatorTalkNow(true);
      setCoordinatorTalkNowPending(false);
    }, 850);
    return () => window.clearTimeout(showHandle);
  }, [coordinatorTalkNowPending, isCallConnected, activeCallAssistant, canonicalCoordinatorId]);

  // Auto-dismiss the cue after a short, readable window.
  React.useEffect(() => {
    if (!showCoordinatorTalkNow) return;
    const hideHandle = window.setTimeout(() => setShowCoordinatorTalkNow(false), 3_000);
    return () => window.clearTimeout(hideHandle);
  }, [showCoordinatorTalkNow]);

  // Seed durable step completion from the server-derived
  // ``completedStepIds`` on the Coordinator/State read. Orchestra
  // re-derives the set from domain data (BYOD email contact,
  // integration secrets, action history, Tasks rows) on every state
  // read, so steps completed in earlier sessions are marked done
  // before the picker renders — the layout already blocks on that
  // read via ``isCoordinatorOnboardingResolvePending``. Live
  // in-session completion still comes from the pane observers
  // (``onSecretsCountChange`` / ``onTasksCountChange`` /
  // ``onHasActiveActionChange``) plus the OAuth-complete refetch;
  // ``markStepCompleted`` is idempotent so the two sources compose
  // freely.
  const serverCompletedStepIds = coordinatorOnboardingState?.completedStepIds;
  const serverSkippedStepIds = coordinatorOnboardingState?.skippedStepIds;
  React.useEffect(() => {
    if (!serverCompletedStepIds) return;
    for (const stepId of serverCompletedStepIds) {
      markStepCompleted(stepId);
    }
  }, [serverCompletedStepIds, markStepCompleted]);
  React.useEffect(() => {
    if (!serverSkippedStepIds) return;
    for (const stepId of serverSkippedStepIds) {
      markStepSkipped(stepId);
    }
  }, [serverSkippedStepIds, markStepSkipped]);

  const handleRandomizeProfile = () => {
    setUserHasChangedPreset(true);
    applyRandomDroidProfile();
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
  // Open the desktop linker (registered-machine list + local setup
  // instructions). Surfaced from the assistant row's "Connect your
  // desktop" menu entry.
  const handleShowInstallInstructions = React.useCallback((assistant: Assistant) => {
    setDesktopLinkerAssistant(assistant);
  }, []);
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

  // A provider OAuth flow (workspace BYOD, integrations) runs in a separate
  // tab that bounces through ``/oauth/complete`` and broadcasts when it's
  // done. Refetch the assistant rows + spaces so any landed connection
  // (e.g. the Coordinator's new workspace email) shows up — and the
  // onboarding step crosses off — without a manual refresh.
  // The connection row can lag the callback redirect slightly, so refetch
  // a couple of times. For the workspace flow we also dismiss the connect
  // dialogs, which the user left open in the original tab.
  React.useEffect(() => {
    const retryTimers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = subscribeOAuthComplete((detail) => {
      const refetch = () => {
        refreshAssistants(false);
        // Re-read Coordinator/State so the server-derived
        // ``completedStepIds`` picks up the credential that just
        // landed (workspace OAuth → ``workspace``, integration
        // OAuth → ``apps``) and the onboarding checklist advances.
        void refetchCoordinatorOnboardingState();
      };
      refetch();
      retryTimers.push(setTimeout(refetch, 1500));
      if (detail.kind === 'workspace') {
        // The OAuth itself succeeded, but the contact row write may have
        // failed (e.g. the mailbox is already connected to another
        // assistant). Surface that instead of a false "connected" — and
        // keep the dialog open so the user can retry with another account.
        const params = new URLSearchParams(detail.query || '');
        const contactError = params.get('contact_error');
        if (contactError || params.get('success') === 'false') {
          toast.error(
            contactError === 'email_in_use'
              ? 'That mailbox is already connected to an assistant. Disconnect it there first, or connect a different account.'
              : "Couldn't finish connecting the workspace. Please try again."
          );
        } else {
          setWorkspaceManagerAssistant(null);
          setWorkspaceManagerInitialProvider(null);
          setContactManagerAssistant(null);
          toast.success('Workspace connected.');
        }
      }
    });
    return () => {
      unsubscribe();
      retryTimers.forEach(clearTimeout);
    };
  }, [refreshAssistants, refetchCoordinatorOnboardingState]);

  const activeCallId = activeCallAssistant?.agentId || popOutCallAssistantId;

  // --- System error listener (assistant-level, above all interaction surfaces) ---
  useAssistantSystemErrors(profileAssistant);

  // Determine active panel for width calculations
  const isFirstViewAfterHire = newlyHiredInfo?.assistant.agentId === profileAssistantId;
  const computedListWidth = isAssistantListFolded ? LIST_MIN_WIDTH : assistantListWidth;

  return (
    <CoordinatorOnboardingProvider value={coordinatorOnboardingCtxValue}>
      <div className="flex h-full flex-col overflow-hidden">
        <AssistantsBanners
          credits={credits}
          isBillingLoading={isBillingLoading}
          isBalanceKnown={isBalanceKnown}
          spendingGateStatus={spendingGateStatus}
          isOrgWorkspace={!!userMeta.orgId}
          isFreeTrial={!!userMeta.isFreeTrial}
          accountStatus={accountStatus}
          billingMode={billingMode}
        />

        {isCoordinatorOnboardingResolvePending ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-background">
            <span className="sr-only">Loading workspace…</span>
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div className="bg-background/85 flex min-h-0 w-full flex-1 overflow-hidden">
              {/* Assistant List */}
              <div
                className="relative h-full flex-shrink-0 border-r border-border bg-card"
                style={{
                  width: computedListWidth,
                  transition: isResizingList ? 'none' : 'width 0.3s ease-in-out',
                }}
              >
                <AssistantList
                  assistants={sidebarAssistants}
                  assistantStatuses={assistantStatuses}
                  assistantError={assistantError}
                  isLoading={isLoadingAssistants}
                  error={assistantError}
                  profileAssistantId={profileAssistantId}
                  onShowProfile={handleAssistantListSelect}
                  onOpenHireDialog={handleOpenHireDialog}
                  onOpenContactManager={handleOpenContactManager}
                  onOpenWorkspaceManager={handleOpenWorkspaceManager}
                  onEditAssistant={handleOpenEditDialog}
                  onConnectDesktop={handleShowInstallInstructions}
                  onEndContract={onDeleteAssistantSubmit}
                  canEndContract={canEndContract}
                  isFolded={isAssistantListFolded}
                  activeCallAssistantId={activeCallId}
                  canHire={canHire}
                  onToggleFold={handleToggleListFold}
                  unreadCounts={chatStreamUnreadCounts}
                  currentUserId={currentUserId}
                  workspace={coordinatorWorkspace}
                  teamsById={teamsById}
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
                  currentUserId={currentUserId}
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
                      ? (chatStreamConnectionStatusByAssistant[profileAssistant.agentId] ??
                        'connecting')
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
                  // The roadmap activates downstream only when the
                  // owner-only settings handler is provided (see
                  // ChatWithInfoPanel — it gates the `roadmap` prop bag on
                  // its presence). Withholding it for non-owners cleanly
                  // hides the Onboarding tab without bespoke prop drilling.
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
                      ? profileAssistant.agentId === canonicalCoordinatorId
                        ? // The Coordinator's onboarding lives in its own
                          // checklist, not the per-assistant setup roadmap, so
                          // its nudge tracks the checklist's outstanding steps.
                          coordinatorOnboardingOutstanding
                        : !!onboardingIncompleteByAgentId[profileAssistant.agentId]
                      : false
                  }
                  forceInfoPanelFocusLayout={isCoordinatorOnboardingFocusLayout}
                  coordinatorOnboarding={coordinatorOnboardingPanelHandlers}
                  // Dock the call into the chat slot whenever an active
                  // call's assistant matches the chat's assistant and the
                  // user hasn't explicitly popped the call out. The
                  // Coordinator-onboarding shell hosts its own docked
                  // render (and unmounts this tree), so no extra guard
                  // is needed here.
                  renderDockedCall={
                    activeCallAssistant &&
                    profileAssistant &&
                    activeCallAssistant.agentId === profileAssistant.agentId &&
                    !isCommunicationDialogOpen
                      ? () => (
                          <RoomContext.Provider value={room}>
                            <AssistantCommunicationDialog
                              docked
                              isOpen
                              onClose={handleHangUp}
                              onPopOut={handlePopOutCall}
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
                              isAssistantPreparing={isAssistantPreparing}
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
                              avatarMood={avatarMood}
                              chatStreamConnectionStatus={
                                chatStreamConnectionStatusByAssistant[
                                  activeCallAssistant.agentId
                                ] ?? 'connecting'
                              }
                              reconnectChatStream={reconnectChatStream}
                              chatStreamActivitySignal={
                                chatActivityCounters[activeCallAssistant.agentId] ?? 0
                              }
                            />
                          </RoomContext.Provider>
                        )
                      : undefined
                  }
                />
              </div>
            </div>
            {showCoordinatorOnboardingIntro && canonicalCoordinator && (
              <div className="absolute inset-0 z-50">
                <CoordinatorOnboarding
                  coordinator={canonicalCoordinator}
                  autoStartIntro={coordinatorIntroReplay}
                  onStartCall={handleStartCoordinatorIntroCall}
                  onComplete={(medium) => {
                    setCoordinatorIntroDismissed(true);
                    setCoordinatorIntroReplay(false);
                    // The intro handed off to a live call — arm the
                    // "Talk now!" cue to fire once that call connects.
                    if (medium === 'call') setCoordinatorTalkNowPending(true);
                  }}
                />
              </div>
            )}
            <CoordinatorTalkNowCue show={showCoordinatorTalkNow} />
          </div>
        )}

        {/* Dialogs and Overlays */}
        <FormProvider {...formMethods}>
          <AssistantHire
            formMethods={formMethods}
            isHireDialogOpen={isHireDialogOpen}
            isHireSubmitting={isFormSubmitting}
            setIsHireDialogOpen={setIsHireDialogOpen}
            isAssistantPresetsOpen={isAssistantPresetsOpen}
            setIsAssistantPresetsOpen={setIsAssistantPresetsOpen}
            currentFilteredPresets={currentFilteredPresets}
            onHireAttempt={handleHireAttempt}
            isProcessingPhoto={isDialogBusyProcessingPhoto}
            isProcessingVoice={isDialogBusyProcessingVoice}
            isCheckingBalance={isCheckingBalance}
            showInsufficientFundsHint={showInsufficientFundsHint}
            setShowInsufficientFundsHint={setShowInsufficientFundsHint}
            onAddPaymentMethod={goToBilling}
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
              onAddPaymentMethod={goToBilling}
              userHasChangedPreset={userHasChangedPreset}
              onRandomizeProfile={handleRandomizeProfile}
              workspaceProvider={hireWorkspaceProvider}
              onWorkspaceProviderSelect={handleHireWorkspaceProviderSelect}
              skipWorkspaceSetup={skipHireWorkspaceSetup}
              onSkipWorkspaceSetupChange={handleSkipHireWorkspaceSetupChange}
              showWorkspaceWarning={showHireWorkspaceWarning}
            />
            <PresetsPanel
              displayedPresets={displayedPresets}
              onPresetSelect={handleUserPresetSelect}
              onClose={() => setIsAssistantPresetsOpen(false)}
              onLoadMore={loadMorePresets}
              canLoadMore={canLoadMorePresets}
              isLoadingMore={isLoadingMorePresets}
              genderFilter={presetGenderFilter}
              onGenderFilterChange={setPresetGenderFilter}
              availableGenders={availableGenders}
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
              onAddPaymentMethod={goToBilling}
              onDeleteAssistant={onDeleteAssistantSubmit}
              canDelete={canEndContract(assistantToEdit)}
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
                onAddPaymentMethod={goToBilling}
                lockIdentityFields={assistantToEdit.isCoordinator}
                lockAppearanceControls={assistantToEdit.isCoordinator}
                onWorkspaceProviderSelect={(provider) => {
                  if (!assistantToEdit) return;
                  setWorkspaceManagerInitialProvider(provider);
                  setWorkspaceManagerAssistant(assistantToEdit);
                  setAssistantToEdit(null);
                }}
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
              onAddPaymentMethod={goToBilling}
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
              onClose={() => {
                setWorkspaceManagerAssistant(null);
                setWorkspaceManagerInitialProvider(null);
              }}
              assistant={workspaceManagerAssistant}
              assistantActions={assistantActions}
              onSuccess={handleUpdateSuccess}
              canWrite={canWrite(workspaceManagerAssistant)}
              initialProvider={workspaceManagerInitialProvider}
            />
          )}
        </FormProvider>

        {desktopLinkerAssistant && (
          <AssistantDesktopLinker
            isOpen={!!desktopLinkerAssistant}
            onClose={() => setDesktopLinkerAssistant(null)}
            assistant={desktopLinkerAssistant}
            assistantActions={assistantActions}
            onLinked={() => refreshAssistants(false)}
            getApiKey={assistantActions.desktop.getApiKey}
          />
        )}

        {/* Page-level dialog — only mounted when the user has popped
         *  the call out of its docked slot. The docked render lives
         *  closer to the call's content (the chat panel in the base
         *  /assistants view, or the Coordinator-onboarding shell)
         *  so we don't need a guard for those shells here. */}
        {activeCallAssistant && isCommunicationDialogOpen && (
          <RoomContext.Provider value={room}>
            <AssistantCommunicationDialog
              isOpen={isCommunicationDialogOpen}
              onClose={handleHangUp}
              onRedock={handleRedockCall}
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
              isAssistantPreparing={isAssistantPreparing}
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
              avatarMood={avatarMood}
              chatStreamConnectionStatus={
                chatStreamConnectionStatusByAssistant[activeCallAssistant.agentId] ?? 'connecting'
              }
              reconnectChatStream={reconnectChatStream}
              chatStreamActivitySignal={chatActivityCounters[activeCallAssistant.agentId] ?? 0}
            />
          </RoomContext.Provider>
        )}
      </div>
    </CoordinatorOnboardingProvider>
  );
}
