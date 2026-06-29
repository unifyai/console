'use client';

import * as React from 'react';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import {
  RightPaneContainer,
  DEFAULT_RIGHT_PANE_STATE,
  type RightPaneState,
  type RightPaneTab,
} from '@/components/Pages/Assistants/RightPaneContainer';
import { AssistantRail, RAIL_COLLAPSED_STORAGE_KEY } from './Rail/AssistantRail';
import { SectionHost } from './Rail/SectionHost';
import { BrainSectionsHost } from './Rail/BrainSectionsHost';
import { SECTION_BY_ID, DEFAULT_SECTION_ID, type SectionDef } from './Rail/sectionConfig';
import {
  Assistant,
  AssistantActions,
  AssistantCallConnectOptions,
  AssistantFormData,
  AssistantUpdatePayload,
  CallOpeningConfig,
  VoiceOption,
} from '@/types/assistants/assistant';
import { ContactType, type OAuthProvider } from '@/types/assistants/contact';
import { toast } from 'sonner';
import { AssistantHire } from './Hire/AssistantHire';
import { AssistantEdit } from './Edit/AssistantEdit';
import { HireForm } from '@/components/Pages/Assistants/Hire/AssistantHireForm';
import { IncomingMeetCallCard } from '@/components/Pages/Assistants/Communication/IncomingMeetCallCard';
import { assistantDisplayName } from '@/lib/assistants/displayName';
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
import { cn } from '@/lib/utils';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import {
  type CoordinatorWorkspaceScope,
  resolveCanonicalWorkspaceCoordinator,
} from '@/lib/assistants/coordinatorIdentity';
import { debugConsole } from '@/lib/consoleDebug';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import {
  CoordinatorOnboardingProvider,
  type CoordinatorOnboardingContextValue,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingContext';
import { CoordinatorOnboarding } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboarding';
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
import { useCallContext } from './Communication/CallProvider';
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
import { createRandomUnityProfile } from '@/utils/assistants/unity-profile-randomizer';
import {
  dispatchCoordinatorOnboardingStepEvent,
  replyStepForCoordinatorTriggerStep,
} from '@/utils/assistants/coordinator-reference-quiz';

const ENABLE_COORDINATOR_ONBOARDING = true;
const COORDINATOR_ONBOARDING_ACCESSIBLE_POLL_MS = 8_000;
const COORDINATOR_ONBOARDING_STEP_RETRY_MS = 30_000;
type ContactManagerInitialTab = ContactType | 'slack';

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
  const onboardingFocusParam = searchParams.get('onboarding');
  const { activeWorkspace, currentUserId } = useWorkspace();
  // Workspace connect (Gmail/Outlook BYOD) needs an OAuth client configured on
  // the deployment. When neither provider is available, the onboarding
  // "Connect workspace" step is suppressed rather than leading to a dead end.
  const { workspaceGoogle, workspaceMicrosoft, contactPhone, contactWhatsapp, contactDiscord } =
    useFeatures();
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
      // Migrate legacy tab ids that no longer map to a right-pane tab:
      //  - 'secrets' was renamed to 'integrations' when the per-assistant
      //    Integrations tab landed.
      //  - 'brain' was the aggregate Brain pane, now retired in favour of
      //    the rail's dedicated Brain sections — fall back to chat.
      // Both drop cleanly once every persisted state has been visited once.
      const migrateTabId = (tab: unknown): RightPaneTab | null => {
        if (typeof tab !== 'string') return null;
        if (tab === 'secrets') return 'integrations';
        if (tab === 'brain') return 'chat';
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
    setActiveBrainSectionId(null);
    setPaneState((prev) => ({
      ...prev,
      primary: { tab: 'chat' },
      secondary: null,
    }));
  }, [profileAssistantId]);

  // --- Rail shell state ---
  // The active rail section is derived: for `view` sections the id equals the
  // right-pane tab, so we read it straight off `paneState`. Brain sections that
  // don't map to a right-pane tab — `brain-view` (dedicated component) and
  // `placeholder` ("coming soon") — can't be derived from `paneState`, so they
  // are tracked separately and take precedence while open.
  const [activeBrainSectionId, setActiveBrainSectionId] = React.useState<string | null>(null);
  const activeSectionId = activeBrainSectionId ?? paneState.primary.tab;
  const activeSectionDef = SECTION_BY_ID[activeSectionId] ?? SECTION_BY_ID[DEFAULT_SECTION_ID];

  const [railCollapsed, setRailCollapsed] = React.useState(false);
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY);
      if (stored !== null) {
        setRailCollapsed(stored === '1');
      } else if (window.matchMedia('(max-width: 1023px)').matches) {
        // No saved preference yet: dock the rail on narrow screens so the
        // section host keeps usable width.
        setRailCollapsed(true);
      }
    } catch {
      /* localStorage unavailable — keep expanded */
    }
  }, []);
  const handleRailCollapsedChange = React.useCallback((collapsed: boolean) => {
    setRailCollapsed(collapsed);
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  // Convenience: chat is "visible" if either slot is showing it. Used by
  // the chat-stream hook below to suppress unread bumps and by the
  // mark-as-read effect to clear the badge when an assistant is opened.
  const isChatVisibleInRightPane =
    paneState.primary.tab === 'chat' ||
    (paneState.secondary !== null && paneState.secondary.tab === 'chat');

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
  // doesn't pop back in after the picker is resolved (the ``intro_watched``
  // write is async + optimistic, but this keeps the dismissal instant).
  const [coordinatorIntroDismissed, setCoordinatorIntroDismissed] = React.useState(false);
  // Global "do onboarding later" switch. When set, the whole Console
  // onboarding surface (intro overlay, focus layout, nudge dot) stands
  // down so the user can use the platform first — mirrored to the
  // Coordinator's prompts server-side. Per-step state is untouched.
  const isCoordinatorOnboardingDeferred = coordinatorOnboardingState?.onboardingDeferred === true;
  const showCoordinatorOnboardingIntro =
    ENABLE_COORDINATOR_ONBOARDING &&
    isCanonicalCoordinatorOwned &&
    !coordinatorIntroDismissed &&
    !isCoordinatorOnboardingDeferred &&
    coordinatorOnboardingState?.mode === 'onboarding' &&
    coordinatorOnboardingState?.introWatched === false;
  const [coordinatorOnboardingFocusLayoutRequest, setCoordinatorOnboardingFocusLayoutRequest] =
    React.useState(0);
  const [firstLoginCommunicationEmailOpenRequest, setFirstLoginCommunicationEmailOpenRequest] =
    React.useState(0);
  const requestCoordinatorOnboardingFocusLayout = React.useCallback(() => {
    setCoordinatorOnboardingFocusLayoutRequest((current) => Math.abs(current) + 1);
  }, []);
  const requestFirstLoginCommunicationEmailOpen = React.useCallback(() => {
    setFirstLoginCommunicationEmailOpenRequest((current) => current + 1);
  }, []);
  const acknowledgeFirstLoginCommunicationEmailOpen = React.useCallback(() => {
    setFirstLoginCommunicationEmailOpenRequest(0);
  }, []);
  const requestCoordinatorOnboardingInfoToggle = React.useCallback(() => {
    setCoordinatorOnboardingFocusLayoutRequest((current) => -(Math.abs(current) + 1));
  }, []);

  // Shared onboarding step progress for the Coordinator onboarding
  // flow. Lifted out of ``CoordinatorOnboarding`` so the same set
  // survives the gradual ↔ info-panel layout transition — the
  // Onboarding tab follows the user into the coordinator's assistant
  // info panel on the base /assistants shell.
  // Durable steps are seeded from the server-derived
  // ``completedStepIds`` on the Coordinator/State read (see the effect
  // below), so progress survives reloads without a separate persisted
  // copy.
  const [completedStepIds, setCompletedStepIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [skippedStepIds, setSkippedStepIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [resetStepIds, setResetStepIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const activeCoordinatorOnboardingStep = coordinatorOnboardingState?.onboardingStep;
  React.useEffect(() => {
    setResetStepIds(new Set());
  }, [canonicalCoordinatorId]);
  // Engagement is a strict superset of completion — engaging
  // ``apps`` (clicking "Connect apps") unlocks the integrations
  // tab even though the row stays pending until a secret actually
  // lands. Completion always implies engagement, so
  // ``markStepCompleted`` below back-fills the engaged set too.
  const [engagedStepIds, setEngagedStepIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const requestedStepTimesRef = React.useRef<Map<string, number>>(new Map());
  React.useEffect(() => {
    requestedStepTimesRef.current.clear();
  }, [canonicalCoordinatorId]);
  const shouldDispatchStepRequest = React.useCallback((stepId: string): boolean => {
    const requestedAt = requestedStepTimesRef.current.get(stepId);
    return !requestedAt || Date.now() - requestedAt > COORDINATOR_ONBOARDING_STEP_RETRY_MS;
  }, []);
  const markStepRequested = React.useCallback((stepId: string) => {
    requestedStepTimesRef.current.set(stepId, Date.now());
  }, []);
  const clearStepRequests = React.useCallback((stepIds: Iterable<string>) => {
    const ids = new Set(stepIds);
    if (ids.size === 0) return;
    for (const stepId of ids) requestedStepTimesRef.current.delete(stepId);
  }, []);
  const markStepCompleted = React.useCallback((stepId: string) => {
    setResetStepIds((prev) => {
      if (!prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
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
  const seedStepCompleted = React.useCallback((stepId: string) => {
    setResetStepIds((prev) => {
      if (!prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
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
    setResetStepIds((prev) => {
      if (!prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
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
  const seedStepSkipped = React.useCallback((stepId: string) => {
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
    setResetStepIds((prev) => {
      if (!prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
    setEngagedStepIds((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);
  const resetStepProgress = React.useCallback(
    (stepIds: readonly string[], resetStepId?: string) => {
      const ids = new Set(stepIds);
      if (ids.size === 0) return;
      setResetStepIds((prev) => new Set([...prev, ...ids]));
      setCompletedStepIds((prev) => {
        const next = new Set(prev);
        for (const stepId of ids) next.delete(stepId);
        return next.size === prev.size ? prev : next;
      });
      setSkippedStepIds((prev) => {
        const next = new Set(prev);
        for (const stepId of ids) next.delete(stepId);
        return next.size === prev.size ? prev : next;
      });
      setEngagedStepIds((prev) => {
        const next = new Set(prev);
        for (const stepId of ids) next.delete(stepId);
        return next.size === prev.size ? prev : next;
      });
      clearStepRequests(ids);
      if (resetStepId) {
        void updateCoordinatorOnboardingState({ resetOnboardingStep: resetStepId });
      } else if (activeCoordinatorOnboardingStep && ids.has(activeCoordinatorOnboardingStep)) {
        void updateCoordinatorOnboardingState({ clearOnboardingStep: true });
      }
    },
    [activeCoordinatorOnboardingStep, clearStepRequests, updateCoordinatorOnboardingState]
  );
  const visibleCompletedStepIds = React.useMemo<ReadonlySet<string>>(() => {
    if (resetStepIds.size === 0) return completedStepIds;
    const next = new Set(completedStepIds);
    for (const stepId of resetStepIds) next.delete(stepId);
    return next;
  }, [completedStepIds, resetStepIds]);
  const visibleSkippedStepIds = React.useMemo<ReadonlySet<string>>(() => {
    if (resetStepIds.size === 0) return skippedStepIds;
    const next = new Set(skippedStepIds);
    for (const stepId of resetStepIds) next.delete(stepId);
    return next;
  }, [resetStepIds, skippedStepIds]);
  const handleCoordinatorOnboardingSectionSkip = React.useCallback(
    (phaseId: string) => {
      void updateCoordinatorOnboardingState({ skipOnboardingPhase: phaseId });
    },
    [updateCoordinatorOnboardingState]
  );
  const handleCoordinatorOnboardingSectionUnskip = React.useCallback(
    (phaseId: string) => {
      void updateCoordinatorOnboardingState({ unskipOnboardingPhase: phaseId });
    },
    [updateCoordinatorOnboardingState]
  );
  // Global defer toggle. Persists to the Coordinator/State row; the
  // optimistic React Query update in the hook flips the layout instantly,
  // and Orchestra suppresses every onboarding event the moment it lands.
  const deferCoordinatorOnboarding = React.useCallback(() => {
    void updateCoordinatorOnboardingState({ onboardingDeferred: true });
  }, [updateCoordinatorOnboardingState]);
  const resumeCoordinatorOnboarding = React.useCallback(() => {
    void updateCoordinatorOnboardingState({ onboardingDeferred: false });
  }, [updateCoordinatorOnboardingState]);
  // Re-enter onboarding from working mode. Flipping ``mode`` back to
  // ``onboarding`` lets Orchestra re-derive the progress render and the
  // Coordinator's nudges re-engage; clearing the defer switch alongside
  // guarantees a clean active flow (a no-op when it wasn't deferred).
  const reactivateCoordinatorOnboarding = React.useCallback(() => {
    void updateCoordinatorOnboardingState({ mode: 'onboarding', onboardingDeferred: false });
  }, [updateCoordinatorOnboardingState]);

  const coordinatorOnboardingCtxValue = React.useMemo<CoordinatorOnboardingContextValue>(
    () => ({
      completedStepIds: visibleCompletedStepIds,
      markStepCompleted,
      resetStepProgress,
      resetStepIds,
      skippedStepIds: visibleSkippedStepIds,
      markStepSkipped,
      markStepUnskipped,
      engagedStepIds,
      markStepEngaged,
      onboardingDeferred: isCoordinatorOnboardingDeferred,
      deferOnboarding: deferCoordinatorOnboarding,
      resumeOnboarding: resumeCoordinatorOnboarding,
      mode: coordinatorOnboardingState?.mode ?? null,
      reactivateOnboarding: reactivateCoordinatorOnboarding,
      onboarding: coordinatorOnboardingState?.onboarding ?? null,
      firstLoginCommunicationEmailOpenRequest,
      acknowledgeFirstLoginCommunicationEmailOpen,
    }),
    [
      visibleCompletedStepIds,
      markStepCompleted,
      resetStepProgress,
      resetStepIds,
      visibleSkippedStepIds,
      markStepSkipped,
      markStepUnskipped,
      engagedStepIds,
      markStepEngaged,
      isCoordinatorOnboardingDeferred,
      deferCoordinatorOnboarding,
      resumeCoordinatorOnboarding,
      coordinatorOnboardingState?.mode,
      reactivateCoordinatorOnboarding,
      coordinatorOnboardingState?.onboarding,
      firstLoginCommunicationEmailOpenRequest,
      acknowledgeFirstLoginCommunicationEmailOpen,
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
    debugConsole('coordinator-onboarding', 'gate.evaluate', {
      canonicalCoordinatorId,
      hasCanonicalCoordinator: !!canonicalCoordinator,
      isLoadingAssistants,
      isCanonicalCoordinatorOwned,
      isCoordinatorOnboardingStateLoading,
      hasCoordinatorOnboardingState: coordinatorOnboardingState !== null,
      mode: coordinatorOnboardingState?.mode ?? null,
      introWatched: coordinatorOnboardingState?.introWatched ?? null,
      onboardingDeferred: coordinatorOnboardingState?.onboardingDeferred ?? null,
      coordinatorIntroDismissed,
      isCoordinatorOnboardingResolvePending,
      showCoordinatorOnboardingIntro,
    });
  }, [
    canonicalCoordinator,
    canonicalCoordinatorId,
    coordinatorIntroDismissed,
    coordinatorOnboardingState,
    isCanonicalCoordinatorOwned,
    isCoordinatorOnboardingResolvePending,
    isCoordinatorOnboardingStateLoading,
    isLoadingAssistants,
    showCoordinatorOnboardingIntro,
  ]);

  // --- Call Management ---
  // The call engine (LiveKit Room + lifecycle) is owned by the layout-level
  // CallProvider so a call survives navigation away from /assistants. This
  // page consumes that shared state and renders the docked / popped-out
  // surface; the provider renders the floating window on other pages. Read
  // here (above the profile-selection and chat-stream effects) so they can use
  // the active-call assistant as a fallback / redock target.
  const {
    room,
    isConnecting: isConnectingCall,
    isConnected: isCallConnected,
    activeCallAssistant,
    callType,
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
    isDocked,
    popOut,
    redock,
  } = useCallContext();

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
      // When landing here mid-call (e.g. returning from another page, which
      // drops the ``?profile=`` param), select the assistant on the call so a
      // docked call redocks into its chat slot instead of being orphaned.
      handleShowProfile(activeCallAssistant?.agentId ?? canonicalCoordinatorId);
    }
  }, [
    activeCallAssistant,
    canonicalCoordinatorId,
    handleShowProfile,
    isLoadingAssistants,
    profileAssistantId,
  ]);

  const consumedOnboardingFocusParamRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!onboardingFocusParam) return;
    if (!canonicalCoordinatorId || isLoadingAssistants) return;
    if (consumedOnboardingFocusParamRef.current === onboardingFocusParam) return;
    consumedOnboardingFocusParamRef.current = onboardingFocusParam;
    handleShowProfile(canonicalCoordinatorId);
    if (onboardingFocusParam.startsWith('toggle:')) {
      requestCoordinatorOnboardingInfoToggle();
    } else {
      requestCoordinatorOnboardingFocusLayout();
    }
  }, [
    canonicalCoordinatorId,
    handleShowProfile,
    isLoadingAssistants,
    onboardingFocusParam,
    requestCoordinatorOnboardingFocusLayout,
    requestCoordinatorOnboardingInfoToggle,
  ]);

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
    React.useState<ContactManagerInitialTab>('email');
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

  // The assistant rang the owner on Unify Meet. We show a pinned incoming-call
  // card; answering runs the normal connect flow. State only here - the Answer
  // button (rendered below) calls handleStartCall, which is defined further down.
  const [incomingMeetCall, setIncomingMeetCall] = React.useState<{
    assistant: Assistant;
    reason: string;
    callSessionId: string;
  } | null>(null);

  const handleUnifyMeetIncoming = React.useCallback(
    (assistantId: string, eventData: Record<string, unknown>) => {
      const assistant = assistants.find((a) => a.agentId === assistantId);
      if (!assistant) return;
      setIncomingMeetCall({
        assistant,
        reason: typeof eventData.reason === 'string' ? eventData.reason : '',
        callSessionId:
          typeof eventData.call_session_id === 'string' ? eventData.call_session_id : '',
      });
    },
    [assistants]
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
      onUnifyMeetIncoming: handleUnifyMeetIncoming,
      onMessageActivity: handleChatActivity,
    },
    {
      userEmail: userMeta.email ?? undefined,
      // Suppress unread bumps for whichever assistant chat the user is
      // currently looking at — either the profile chat panel (only when
      // the right-pane Chat tab is visible in *either* the primary or
      // secondary split slot; on Actions/Brain/etc.-only we still want
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

  // Dock state lives in the layout-level CallProvider (so it persists across
  // navigation): ``isDocked`` true renders the call docked above the chat
  // panel, false lifts it into the floating/modal overlay. The provider snaps
  // back to docked once a call ends so the next one starts docked again.
  const handleStartCall = React.useCallback(
    async (
      assistant: Assistant,
      callType: 'video' | 'audio',
      options?: AssistantCallConnectOptions
    ) => {
      if (activeCallAssistant) {
        if (activeCallAssistant.agentId !== assistant.agentId) {
          toast.info('A call is already in progress with another assistant.');
        }
        // Same-assistant re-click while a call is already running is a no-op —
        // the call surface is already on screen.
        return;
      }

      // Fresh call: stay docked by default.
      redock();
      await startCall(assistant, callType, options);
    },
    [startCall, redock, activeCallAssistant]
  );

  const handleHangUp = React.useCallback(async () => {
    await hangUpCall();
  }, [hangUpCall]);

  const handleAnswerIncomingMeet = React.useCallback(() => {
    if (!incomingMeetCall) return;
    const { assistant, reason, callSessionId } = incomingMeetCall;
    setIncomingMeetCall(null);
    handleShowProfile(assistant.agentId);
    const openingConfig: CallOpeningConfig = {
      mode: 'briefed',
      systemContext: reason || 'Continuing our conversation on the live call.',
      source: 'unify_meet_ring',
    };
    void handleStartCall(assistant, 'audio', {
      openingConfig,
      callSessionId: callSessionId || undefined,
      waitForAssistantReady: true,
    });
  }, [incomingMeetCall, handleShowProfile, handleStartCall]);

  const handleDeclineIncomingMeet = React.useCallback(() => {
    setIncomingMeetCall(null);
  }, []);

  // Dismiss the incoming-call card once a call is actually active (the owner
  // answered, or another call started), and time it out (~30s) if ignored - the
  // runtime falls the conversation back to text on its own no-answer timeout.
  React.useEffect(() => {
    if (!incomingMeetCall) return;
    if (activeCallAssistant) {
      setIncomingMeetCall(null);
      return;
    }
    const timer = setTimeout(() => setIncomingMeetCall(null), 30000);
    return () => clearTimeout(timer);
  }, [incomingMeetCall, activeCallAssistant]);

  const {
    setPresetAgeFilter,
    setPresetNationalityFilter,
    setPresetGenderFilter,
    setPresetLanguageFilter,
    currentFilteredPresets,
    allAssistantPresets,
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

  const applyRandomUnityProfile = React.useCallback(() => {
    const profile = createRandomUnityProfile();
    formMethods.setValue('firstName', profile.firstName, { shouldValidate: true });
    formMethods.setValue('surname', profile.surname, { shouldValidate: true });
    formMethods.setValue('jobTitle', profile.jobTitle, { shouldValidate: true });
    formMethods.setValue('about', profile.about, { shouldValidate: true });
    formMethods.setValue('isPresetPristine', false);
  }, [formMethods]);

  // Auto-select the first filtered preset for hidden defaults like voice, then
  // Replace the visible profile fields with a branded unity profile.
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
      applyRandomUnityProfile();
    }
  }, [
    needsPresetSelection,
    currentFilteredPresets,
    userHasChangedPreset,
    selectPresetForHireForm,
    formMethods,
    applyRandomUnityProfile,
  ]);

  const handleOpenEditDialog = React.useCallback(
    (assistant: Assistant) => {
      loadAssistantForEdit(assistant);
      setAssistantToEdit(assistant);
    },
    [loadAssistantForEdit]
  );

  const handleOpenContactManager = React.useCallback(
    (assistant: Assistant, tab: ContactManagerInitialTab = 'email') => {
      loadAssistantForEdit(assistant);
      setContactManagerInitialTab(tab);
      setContactManagerAssistant(assistant);
    },
    [loadAssistantForEdit]
  );

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
  // Carries the gradual-onboarding "open the next surface" behaviour into
  // the info-panel checklist: a checklist row engages its step and
  // navigates the right pane's main slot to the matching tab
  // (Integrations / Actions / Tasks) so the user lands where the work
  // happens. The coordinator is already the selected profile while its
  // onboarding card is open, so the tab renders against it.
  const handleCoordinatorOpenPaneTab = React.useCallback(
    (tab: RightPaneTab, stepId: string) => {
      markStepEngaged(stepId);
      setActiveBrainSectionId(null);
      setPaneState((prev) => ({ ...prev, primary: { tab } }));
    },
    [markStepEngaged]
  );

  // Open the user's account settings in a new tab so the chat session
  // isn't disrupted while they configure their profile. Optional `tab`
  // mirrors the /account page's `?tab=` param (see SettingsView) so
  // callers can deep-link straight to the relevant section.
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

  const handleCoordinatorStartOnboardingStep = React.useCallback(
    (stepId: string) => {
      if (!shouldDispatchStepRequest(stepId)) {
        void refetchCoordinatorOnboardingState();
        return;
      }
      markStepEngaged(stepId);
      markStepRequested(stepId);
      void updateCoordinatorOnboardingState({ onboardingStep: stepId });
    },
    [
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      shouldDispatchStepRequest,
      updateCoordinatorOnboardingState,
    ]
  );

  const handleCoordinatorTriggerReferenceStep = React.useCallback(
    (stepId: string) => {
      if (!canonicalCoordinator) return;
      const step = coordinatorOnboardingState?.onboarding?.steps.find(
        (candidate) => candidate.id === stepId
      );
      if (!step) return;
      if (!shouldDispatchStepRequest(stepId)) {
        void refetchCoordinatorOnboardingState();
        return;
      }
      markStepEngaged(stepId);
      markStepRequested(stepId);
      void (async () => {
        try {
          const event = await dispatchCoordinatorOnboardingStepEvent(
            canonicalCoordinator.agentId,
            step
          );
          if (!event) return;

          const replyStepId = replyStepForCoordinatorTriggerStep(step);
          if (replyStepId) {
            markStepEngaged(replyStepId);
            void updateCoordinatorOnboardingState({ onboardingStep: replyStepId });
          }
          void refetchCoordinatorOnboardingState();
        } catch (error) {
          console.error('[Coordinator onboarding] Failed to dispatch onboarding event:', error);
          toast.error('Could not start this task. Please try again.');
        }
      })();
    },
    [
      canonicalCoordinator,
      coordinatorOnboardingState?.onboarding?.steps,
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      shouldDispatchStepRequest,
      updateCoordinatorOnboardingState,
    ]
  );

  const handleCoordinatorAddWhatsappNumber = React.useCallback(() => {
    handleCoordinatorStartOnboardingStep('whatsapp-number');
    handleOpenUserSettings('contact-info');
  }, [handleCoordinatorStartOnboardingStep, handleOpenUserSettings]);

  const handleCoordinatorAddPhoneNumber = React.useCallback(() => {
    handleCoordinatorStartOnboardingStep('phone-number');
    handleOpenUserSettings('contact-info');
  }, [handleCoordinatorStartOnboardingStep, handleOpenUserSettings]);

  const handleCoordinatorConnectSlack = React.useCallback(() => {
    if (!canonicalCoordinator) return;
    handleCoordinatorStartOnboardingStep('slack-connect');
    handleOpenContactManager(canonicalCoordinator, 'slack');
  }, [canonicalCoordinator, handleCoordinatorStartOnboardingStep, handleOpenContactManager]);

  const handleCoordinatorConnectDiscord = React.useCallback(() => {
    if (!canonicalCoordinator) return;
    handleCoordinatorStartOnboardingStep('discord-connect');
    handleOpenContactManager(canonicalCoordinator, 'discord');
  }, [canonicalCoordinator, handleCoordinatorStartOnboardingStep, handleOpenContactManager]);

  // Whether the Coordinator still has an actionable onboarding step left.
  // Drives the "Assistant info" nudge dot and request-scoped onboarding
  // focus layout from the coordinator checklist (not the per-assistant roadmap).
  const coordinatorOnboardingOutstanding = React.useMemo(
    () =>
      isCanonicalCoordinatorOwned &&
      !isCoordinatorOnboardingDeferred &&
      hasOutstandingCoordinatorOnboarding(coordinatorOnboardingState?.onboarding ?? null),
    [
      isCanonicalCoordinatorOwned,
      isCoordinatorOnboardingDeferred,
      coordinatorOnboardingState?.onboarding,
    ]
  );
  const canApplyCoordinatorOnboardingFocusLayout =
    ENABLE_COORDINATOR_ONBOARDING &&
    isCanonicalCoordinatorOwned &&
    coordinatorOnboardingState?.mode === 'onboarding' &&
    coordinatorOnboardingOutstanding &&
    !showCoordinatorOnboardingIntro &&
    canonicalCoordinatorId !== null &&
    profileAssistantId === canonicalCoordinatorId &&
    (coordinatorIntroDismissed || coordinatorOnboardingState?.introWatched === true);
  const isCoordinatorOnboardingFocusLayout =
    canApplyCoordinatorOnboardingFocusLayout && coordinatorOnboardingFocusLayoutRequest > 0;

  const hasRequestedInitialCoordinatorFocusLayoutRef = React.useRef(false);
  React.useEffect(() => {
    if (hasRequestedInitialCoordinatorFocusLayoutRef.current) return;
    if (isCoordinatorOnboardingResolvePending || isLoadingAssistants) return;

    const awaitingBareLandingSelection =
      !landedWithProfileDeepLinkRef.current && !!canonicalCoordinatorId && !profileAssistantId;
    if (awaitingBareLandingSelection) return;

    hasRequestedInitialCoordinatorFocusLayoutRef.current = true;
    if (canApplyCoordinatorOnboardingFocusLayout) {
      requestCoordinatorOnboardingFocusLayout();
    }
  }, [
    canApplyCoordinatorOnboardingFocusLayout,
    canonicalCoordinatorId,
    isCoordinatorOnboardingResolvePending,
    isLoadingAssistants,
    profileAssistantId,
    requestCoordinatorOnboardingFocusLayout,
  ]);

  const seededCoordinatorFocusPaneRequestRef = React.useRef(0);
  React.useLayoutEffect(() => {
    if (!isCoordinatorOnboardingFocusLayout) return;
    if (seededCoordinatorFocusPaneRequestRef.current === coordinatorOnboardingFocusLayoutRequest) {
      return;
    }
    seededCoordinatorFocusPaneRequestRef.current = coordinatorOnboardingFocusLayoutRequest;
    setPaneState((prev) =>
      prev.primary.tab === 'chat' && prev.secondary === null
        ? prev
        : {
            ...prev,
            primary: { tab: 'chat' },
            secondary: null,
          }
    );
  }, [coordinatorOnboardingFocusLayoutRequest, isCoordinatorOnboardingFocusLayout]);

  const coordinatorOnboardingPanelHandlers = React.useMemo(() => {
    if (!isCanonicalCoordinatorOwned || !canonicalCoordinator) return undefined;
    // Live step completion is only meaningful while the Coordinator is
    // the selected profile — that's whose Integrations / Tasks / Actions
    // panes are mounted in the right pane. Gating ``onStepComplete`` on
    // this keeps another assistant's domain data from ticking off the
    // Coordinator's onboarding steps.
    const isProfileCoordinator = profileAssistantId === canonicalCoordinator.agentId;
    return {
      onStartOnboardingStep: handleCoordinatorStartOnboardingStep,
      onTriggerReferenceStep: handleCoordinatorTriggerReferenceStep,
      onAddWhatsappNumber: contactWhatsapp ? handleCoordinatorAddWhatsappNumber : undefined,
      onAddPhoneNumber: contactPhone ? handleCoordinatorAddPhoneNumber : undefined,
      onConnectSlack:
        userMeta.slackOwner && assistantActions.slack ? handleCoordinatorConnectSlack : undefined,
      onConnectDiscord: contactDiscord ? handleCoordinatorConnectDiscord : undefined,
      onConnectWorkspace: workspaceConnectAvailable
        ? () => {
            markStepEngaged('workspace');
            handleOpenWorkspaceManager(canonicalCoordinator);
          }
        : undefined,
      onConnectApps: () => handleCoordinatorOpenPaneTab('integrations', 'apps'),
      onActNow: () => handleCoordinatorOpenPaneTab('actions', 'act'),
      onScheduleTask: () => handleCoordinatorOpenPaneTab('tasks', 'schedule'),
      onSkipSection: handleCoordinatorOnboardingSectionSkip,
      onUnskipSection: handleCoordinatorOnboardingSectionUnskip,
      onStepComplete: isProfileCoordinator ? markStepCompleted : undefined,
      // Flavours the "Ask T-W1N to do something" suggestion chips:
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
    assistantActions.slack,
    contactDiscord,
    contactPhone,
    contactWhatsapp,
    userMeta.slackOwner,
    markStepEngaged,
    markStepCompleted,
    handleCoordinatorStartOnboardingStep,
    handleCoordinatorTriggerReferenceStep,
    handleCoordinatorAddWhatsappNumber,
    handleCoordinatorAddPhoneNumber,
    handleCoordinatorConnectSlack,
    handleCoordinatorConnectDiscord,
    handleCoordinatorOpenPaneTab,
    handleCoordinatorOnboardingSectionSkip,
    handleCoordinatorOnboardingSectionUnskip,
    workspaceConnectAvailable,
  ]);

  // Starts the Coordinator call from the onboarding intro. Selecting the
  // Coordinator first ensures the call docks into its right pane — the
  // normal docked-call path keys on the active call's assistant matching
  // the selected profile.
  const handleStartCoordinatorIntroCall = React.useCallback(
    (assistant: Assistant, type: 'video' | 'audio', options?: AssistantCallConnectOptions) => {
      handleShowProfile(assistant.agentId);
      const isFreshOnboardingIntro =
        coordinatorOnboardingState?.mode === 'onboarding' &&
        coordinatorOnboardingState?.introWatched === false &&
        coordinatorOnboardingState?.onboardingDeferred !== true;
      const openingConfig: CallOpeningConfig = isFreshOnboardingIntro
        ? {
            mode: 'recorded',
            recordingAsset: 'coordinator_onboarding_intro',
            source: 'coordinator_onboarding_intro',
          }
        : {
            mode: 'speak',
            source: options?.openingConfig?.source ?? 'coordinator_onboarding_intro',
          };
      return handleStartCall(assistant, type, { ...options, openingConfig });
    },
    [handleShowProfile, handleStartCall, coordinatorOnboardingState]
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
  const hasAccessibleCoordinatorOnboardingTargets =
    (coordinatorOnboardingState?.onboarding?.nextTargets.length ?? 0) > 0;
  React.useEffect(() => {
    if (!serverCompletedStepIds) return;
    for (const stepId of serverCompletedStepIds) {
      seedStepCompleted(stepId);
    }
    clearStepRequests(serverCompletedStepIds);
  }, [clearStepRequests, serverCompletedStepIds, seedStepCompleted]);
  React.useEffect(() => {
    if (!serverSkippedStepIds) return;
    for (const stepId of serverSkippedStepIds) {
      seedStepSkipped(stepId);
    }
    clearStepRequests(serverSkippedStepIds);
  }, [clearStepRequests, serverSkippedStepIds, seedStepSkipped]);
  React.useEffect(() => {
    if (
      coordinatorOnboardingState?.mode !== 'onboarding' ||
      isCoordinatorOnboardingDeferred ||
      !hasAccessibleCoordinatorOnboardingTargets
    ) {
      return;
    }
    const handle = window.setInterval(() => {
      void refetchCoordinatorOnboardingState();
    }, COORDINATOR_ONBOARDING_ACCESSIBLE_POLL_MS);
    return () => window.clearInterval(handle);
  }, [
    coordinatorOnboardingState?.mode,
    hasAccessibleCoordinatorOnboardingTargets,
    isCoordinatorOnboardingDeferred,
    refetchCoordinatorOnboardingState,
  ]);
  React.useEffect(() => {
    if (!activeCoordinatorOnboardingStep) return;
    if (
      !serverCompletedStepIds?.includes(activeCoordinatorOnboardingStep) &&
      !serverSkippedStepIds?.includes(activeCoordinatorOnboardingStep)
    ) {
      return;
    }
    void updateCoordinatorOnboardingState({ clearOnboardingStep: true });
  }, [
    activeCoordinatorOnboardingStep,
    serverCompletedStepIds,
    serverSkippedStepIds,
    updateCoordinatorOnboardingState,
  ]);

  const handleRandomizeProfile = () => {
    setUserHasChangedPreset(true);
    applyRandomUnityProfile();
  };

  // The hire form registers its combined profile+appearance randomizer here so
  // the dialog header's Randomize button can drive it from outside the form.
  const hireRandomizeRef = React.useRef<(() => void) | null>(null);
  const registerHireRandomize = React.useCallback((randomize: () => void) => {
    hireRandomizeRef.current = randomize;
  }, []);
  const handleHeaderRandomize = React.useCallback(() => {
    hireRandomizeRef.current?.();
  }, []);

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
  // We also stamp a localStorage flag so the focus-refresh effect
  // below knows the user might have just changed something on their
  // profile — refreshing server data on every focus event is
  // wasteful, but doing so after an account-page round-trip ensures
  // derivations like `hasUserPhoneNumber` reflect the edit without
  // a manual reload.
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
          // Keep the workspace dialog open so it transitions into the
          // connected view (where the file-access step lives). The
          // ``assistants`` re-sync effect below repoints the held snapshot at
          // the freshly-connected assistant once the refetch lands.
          setWorkspaceManagerInitialProvider(null);
          setContactManagerAssistant(null);
          toast.success('Workspace connected. Choose which files to share below.');
        }
      }
    });
    return () => {
      unsubscribe();
      retryTimers.forEach(clearTimeout);
    };
  }, [refreshAssistants, refetchCoordinatorOnboardingState]);

  // Keep the open workspace dialog's held assistant in sync with the refreshed
  // list so a just-connected mailbox/provider surfaces (and the file-access
  // step appears) without forcing the user to reopen the dialog.
  React.useEffect(() => {
    if (!workspaceManagerAssistant) return;
    const fresh = assistants.find((a) => a.agentId === workspaceManagerAssistant.agentId);
    if (
      fresh &&
      (fresh.email !== workspaceManagerAssistant.email ||
        fresh.emailProvider !== workspaceManagerAssistant.emailProvider)
    ) {
      setWorkspaceManagerAssistant(fresh);
    }
  }, [assistants, workspaceManagerAssistant]);

  const activeCallId = activeCallAssistant?.agentId ?? null;

  // --- System error listener (assistant-level, above all interaction surfaces) ---
  useAssistantSystemErrors(profileAssistant);

  const isFirstViewAfterHire = newlyHiredInfo?.assistant.agentId === profileAssistantId;

  // Rail section selection: `view` sections drive the right-pane tab, the
  // non-tab Brain sections — `brain-view` (dedicated component, e.g. Contacts /
  // Transcripts / Functions / Guidance / Knowledge) and `placeholder`
  // ("coming soon") — take over the section host via `activeBrainSectionId`.
  // `action` sections (none today; channel-identity provisioning now lives
  // behind the Contacts directory's "Add contact" affordance) open a dialog.
  const handleSelectSection = React.useCallback(
    (section: SectionDef) => {
      if (section.kind === 'action') {
        if (profileAssistant) handleOpenContactManager(profileAssistant);
        return;
      }
      if (section.kind === 'brain-view' || section.kind === 'placeholder') {
        setActiveBrainSectionId(section.id);
        return;
      }
      setActiveBrainSectionId(null);
      if (section.tab) {
        const tab = section.tab;
        setPaneState((prev) => ({ ...prev, primary: { tab } }));
      }
    },
    [profileAssistant, handleOpenContactManager]
  );

  // The full prop bag the rail forwards to the embedded `AssistantList` (the
  // unity switcher). `isFolded`/`onToggleFold` are owned by the rail, so the
  // popover list always renders expanded.
  const railListProps: React.ComponentProps<typeof AssistantList> = {
    assistants: sidebarAssistants,
    assistantStatuses,
    assistantError,
    isLoading: isLoadingAssistants,
    error: assistantError,
    profileAssistantId,
    onShowProfile: handleAssistantListSelect,
    onOpenHireDialog: handleOpenHireDialog,
    onOpenContactManager: handleOpenContactManager,
    onOpenWorkspaceManager: handleOpenWorkspaceManager,
    onEditAssistant: handleOpenEditDialog,
    onConnectDesktop: handleShowInstallInstructions,
    onEndContract: onDeleteAssistantSubmit,
    canEndContract,
    isFolded: false,
    activeCallAssistantId: activeCallId,
    canHire,
    unreadCounts: chatStreamUnreadCounts,
    currentUserId,
    workspace: coordinatorWorkspace,
    teamsById,
  };

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
            <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
              <AssistantRail
                activeUnity={profileAssistant}
                listProps={railListProps}
                activeSection={activeSectionId}
                onSelectSection={handleSelectSection}
                collapsed={railCollapsed}
                onCollapsedChange={handleRailCollapsedChange}
              />

              <SectionHost
                section={activeSectionDef}
                renderView={() => {
                  if (activeSectionDef.kind === 'brain-view' && profileAssistant) {
                    return (
                      <BrainSectionsHost
                        assistant={profileAssistant}
                        activeSectionId={activeSectionDef.id}
                        onManageContacts={() => handleOpenContactManager(profileAssistant)}
                      />
                    );
                  }
                  return (
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
                      infoPanelFocusLayoutRequest={
                        canApplyCoordinatorOnboardingFocusLayout
                          ? coordinatorOnboardingFocusLayoutRequest
                          : 0
                      }
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
                        isDocked
                          ? () => (
                              <RoomContext.Provider value={room}>
                                <AssistantCommunicationDialog
                                  docked
                                  isOpen
                                  onClose={handleHangUp}
                                  onPopOut={popOut}
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
                                  isRemoteControlInteractiveLoading={
                                    isRemoteControlInteractiveLoading
                                  }
                                  toggleRemoteControlInteractive={toggleRemoteControlInteractive}
                                  isDesktopReady={isDesktopReady}
                                  callType={callType}
                                  isSpeakerMuted={isSpeakerMuted}
                                  onToggleSpeaker={toggleSpeakerMute}
                                  avatarMood={avatarMood}
                                  coordinatorAvatarVisible={!showCoordinatorOnboardingIntro}
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
                  );
                }}
              />
            </div>
            {showCoordinatorOnboardingIntro && canonicalCoordinator && (
              <div className="absolute inset-0 z-50">
                <CoordinatorOnboarding
                  coordinator={canonicalCoordinator}
                  onStartCall={handleStartCoordinatorIntroCall}
                  onDiscardCall={handleHangUp}
                  onComplete={() => {
                    setCoordinatorIntroDismissed(true);
                    requestCoordinatorOnboardingFocusLayout();
                    requestFirstLoginCommunicationEmailOpen();
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Dialogs and Overlays */}
        {incomingMeetCall && !activeCallAssistant && (
          <IncomingMeetCallCard
            assistantName={assistantDisplayName(incomingMeetCall.assistant)}
            onAnswer={handleAnswerIncomingMeet}
            onDecline={handleDeclineIncomingMeet}
          />
        )}
        <FormProvider {...formMethods}>
          <AssistantHire
            formMethods={formMethods}
            isHireDialogOpen={isHireDialogOpen}
            isHireSubmitting={isFormSubmitting}
            setIsHireDialogOpen={setIsHireDialogOpen}
            onHireAttempt={handleHireAttempt}
            isProcessingPhoto={isDialogBusyProcessingPhoto}
            isProcessingVoice={isDialogBusyProcessingVoice}
            isCheckingBalance={isCheckingBalance}
            showInsufficientFundsHint={showInsufficientFundsHint}
            setShowInsufficientFundsHint={setShowInsufficientFundsHint}
            onAddPaymentMethod={goToBilling}
            onRandomize={handleHeaderRandomize}
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
              onRegisterRandomize={registerHireRandomize}
              workspaceProvider={hireWorkspaceProvider}
              onWorkspaceProviderSelect={handleHireWorkspaceProviderSelect}
              skipWorkspaceSetup={skipHireWorkspaceSetup}
              onSkipWorkspaceSetupChange={handleSkipHireWorkspaceSetupChange}
              showWorkspaceWarning={showHireWorkspaceWarning}
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
        {activeCallAssistant && !isDocked && (
          <RoomContext.Provider value={room}>
            <AssistantCommunicationDialog
              isOpen={!isDocked}
              onClose={handleHangUp}
              onRedock={redock}
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
