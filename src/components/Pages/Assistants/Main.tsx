'use client';

import * as React from 'react';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import dynamic from 'next/dynamic';
import {
  RightPaneContainer,
  DEFAULT_RIGHT_PANE_STATE,
  type RightPaneIntegrationsState,
  type RightPaneState,
  type RightPaneTab,
} from '@/components/Pages/Assistants/RightPaneContainer';
import { AssistantRail, RAIL_COLLAPSED_STORAGE_KEY } from './Rail/AssistantRail';
import { SectionHost } from './Rail/SectionHost';
import { BrainSectionsHost } from './Rail/BrainSectionsHost';
import { AssistantInfoPanelLayout } from './Layout/AssistantInfoPanelLayout';
import { EntityInfoPanelLayout } from './Layout/EntityInfoPanelLayout';
import {
  SECTION_BY_ID,
  DEFAULT_SECTION_ID,
  sectionAppliesTo,
  resolveSectionForEntity,
  type SectionDef,
  type SelectorEntityKind,
} from './Rail/sectionConfig';
import {
  groupEntityKey,
  humanEntityKey,
  isNonAssistantEntityKey,
  parseSelectedEntityKey,
  resolveOrgEntitySelection,
  teamEntityKey,
} from '@/lib/assistants/selectedEntity';
import { useOrgRoster } from '@/hooks/Assistants/useOrgRoster';
import {
  withOrgProfileImageForTeams,
  withOrgNameForManagedTeams,
  type RosterHuman,
} from '@/types/orgChat';
import { usePresenceHeartbeat } from '@/hooks/Assistants/usePresenceHeartbeat';
import { useOrgChat } from '@/hooks/Assistants/useOrgChat';
import { HumanWorkspace } from '@/components/Pages/Assistants/OrgChat/HumanWorkspace';
import { HumanInfoSidePanelContent } from '@/components/Pages/Assistants/OrgChat/HumanInfoSidePanelContent';
import { TeamWorkspace } from '@/components/Pages/Assistants/OrgChat/TeamWorkspace';
import { TeamInfoSidePanelContent } from '@/components/Pages/Assistants/OrgChat/TeamInfoSidePanelContent';
import { GroupWorkspace } from '@/components/Pages/Assistants/OrgChat/GroupWorkspace';
import { GroupInfoSidePanelContent } from '@/components/Pages/Assistants/OrgChat/GroupInfoSidePanelContent';
import { CreateGroupDialog } from '@/components/Pages/Assistants/OrgChat/CreateGroupDialog';
import {
  TeamBrainSectionsHost,
  isTeamBrainSectionId,
} from '@/components/Pages/Assistants/OrgChat/TeamBrainSectionsHost';
import type { ActiveEntityFace } from '@/components/Layout/Shell/AssistantSwitcher';
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
import { Loader2 } from 'lucide-react';
import { AssistantSectionSkeleton } from '@/components/Common/Loaders/Skeletons';

const AssistantHire = dynamic(
  () => import('./Hire/AssistantHire').then((m) => ({ default: m.AssistantHire })),
  { loading: () => null }
);
const AssistantEdit = dynamic(
  () => import('./Edit/AssistantEdit').then((m) => ({ default: m.AssistantEdit })),
  { loading: () => null }
);
const CoordinatorOnboarding = dynamic(
  () =>
    import('./Coordinator/CoordinatorOnboarding').then((m) => ({
      default: m.CoordinatorOnboarding,
    })),
  { loading: () => null }
);
import { HireForm } from '@/components/Pages/Assistants/Hire/AssistantHireForm';
import { IncomingMeetCallCard } from '@/components/Pages/Assistants/Communication/IncomingMeetCallCard';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import {
  COORDINATOR_ONBOARDING_PANEL_REQUEST_EVENT,
  requestAssistantInfoPanelOpen,
  requestAssistantInfoPanelOpenAfterSelect,
  requestAssistantInfoPanelToggle,
  type CoordinatorOnboardingPanelRequestDetail,
} from '@/lib/assistants/infoPanelVisibility';
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
import { useRunningTaskSnapshot } from '@/hooks/Assistants/useRunningTaskSnapshot';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { useAssistantOnboardingSummaries } from '@/hooks/Assistants/useAssistantOnboardingSummaries';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { FormProvider } from 'react-hook-form';
import { isAssistantsPath } from '@/lib/navigation/appShellRoutes';
import {
  pathnameFromHref,
  usePendingAssistantSectionTarget,
  usePendingShellNavigationTarget,
  useAppShellNavigation,
} from '@/lib/navigation/AppShellRouter';
import {
  OPEN_ASSISTANT_CHAT_EVENT,
  type OpenAssistantChatDetail,
} from '@/lib/navigation/openAssistantChat';
import { AssistantFloatingChatHost } from '@/components/Pages/Assistants/Chat/AssistantFloatingChatHost';
import { AssistantSwitcherBridgeSync } from '@/components/Layout/Shell/AssistantSwitcherBridgeSync';
import { writeStoredSelectedAssistantId } from '@/components/Layout/Shell/AssistantSwitcherBridgeContext';
import {
  PLATFORM_HOME_NAVIGATION_EVENT,
  requestPlatformHomeNavigation,
} from '@/lib/navigation/platformHome';
import { cn } from '@/lib/utils';
import { maxWidthMediaQuery } from '@/constants/breakpoints';
import { useBreakpoint } from '@/hooks/Common/useMobile';
import { Button } from '@/components/UI/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { Sheet, SheetContent } from '@/components/UI/sheet';
import { Menu } from 'lucide-react';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import {
  type CoordinatorWorkspaceScope,
  resolveCanonicalWorkspaceCoordinator,
} from '@/lib/assistants/coordinatorIdentity';
import { buildDisplayedAssistantStatuses } from '@/lib/assistants/coordinatorOnboardingPresence';
import { debugConsole } from '@/lib/consoleDebug';
import { wakeCoordinator } from '@/lib/client/coordinator';
import { ENABLE_INTEGRATION_LABEL_FILTER } from '@/lib/integrations/integrationLabelFilter';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { useCoordinatorOnboardingInvalidation } from '@/hooks/Assistants/useCoordinatorOnboardingInvalidation';
import { useCoordinatorAppsConnectFlow } from '@/hooks/Assistants/useCoordinatorAppsConnectFlow';
import {
  APPS_ONBOARDING_STEP_ID,
  broadcastIntegrationDisconnectSettled,
  disconnectConnectedIntegrationsForAppsReset,
  schedulePostIntegrationConnectRefetches,
} from '@/lib/assistants/coordinatorIntegrationConnect';
import {
  COORDINATOR_ONBOARDING_CHAT_INTRO_TYPING_DELAY_MS,
  COORDINATOR_ONBOARDING_CHAT_INTRO_TYPING_FALLBACK_MS,
} from '@/utils/assistants/coordinator-onboarding-intro';
import {
  clearCoordinatorOnboardingStaleFlag,
  COORDINATOR_ONBOARDING_STALE_EVENT,
  readCoordinatorOnboardingStaleAt,
} from '@/lib/assistants/coordinatorOnboardingInvalidation';
import {
  CoordinatorOnboardingProvider,
  type CoordinatorOnboardingContextValue,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingContext';
import {
  hasOutstandingCoordinatorOnboarding,
  type ChecklistAction,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingChecklist';
import { subscribeOAuthComplete } from '@/utils/assistants/oauth';
import { readActionDeepLink } from '@/utils/assistants/action-deep-link';
import { resolveCallGate } from '@/utils/assistants/call-gate';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage, CallPill, RequestSentAck } from '@/types/assistants/chat';
import { AssistantDesktopLinker } from './Profile/AssistantDesktopLinker';
import { AssistantContactManager } from './Profile/AssistantContactManager';
import { AssistantComputerUseManager } from './Profile/AssistantComputerUseManager';
import { AssistantWorkspaceManager } from './Profile/AssistantWorkspaceManager';
import { AssistantBrainManager } from './Profile/AssistantBrainManager';
import { useCallContext } from './Communication/CallProvider';
import { useContactIdPrefetch } from '@/hooks/Assistants/useContactIdPrefetch';
import {
  useAssistantChatStream,
  type ChatStreamPair,
} from '@/hooks/Assistants/useAssistantChatStream';
import {
  useAssistantTranscriptReconciler,
  type TranscriptReconcilerPair,
} from '@/hooks/Assistants/useAssistantTranscriptReconciler';
import { useUnreadDocumentTitle } from '@/hooks/Assistants/useUnreadDocumentTitle';
import type {
  ParsedInboundChatMessage,
  ParsedReactionUpdate,
} from '@/utils/assistants/chat-sse-frame';
import type { BroadcastMessagePayload } from '@/types/assistants/chat';
import type { SlackInstall, SlackInstallOwner } from '@/types/slack/install';
import type { MsTeamsBotInstall, MsTeamsBotInstallOwner } from '@/types/ms-teams-bot/install';
import { buildMsTeamsChatDeepLink, MS_TEAMS_APP_CATALOG_ID } from '@/utils/ms-teams-bot/deepLink';
import {
  MS_TEAMS_BOT_CONNECTED_PARAM,
  MS_TEAMS_BOT_CONNECT_ERROR_PARAM,
  msTeamsBotConnectErrorMessage,
} from '@/lib/ms-teams-bot/connectLink';
import { RoomContext } from '@livekit/components-react';
import { AssistantCommunicationDialog } from './Communication/AssistantCommunicationDialog';
import { useUserSpending } from '@/hooks/User/useUserSpending';
import { useOrgSpending } from '@/hooks/Organizations/useOrgSpending';
import { useSearchParams } from 'next/navigation';
import { useSpendingGate } from '@/hooks/Assistants/useSpendingGate';
import { SpendingDisplayProps } from '@/types/assistants/spending';
import { useAssistantSystemErrors } from '@/hooks/Assistants/useAssistantSystemErrors';
import { useAssistantPresenceWake } from '@/hooks/Assistants/useAssistantPresenceWake';
import { useConsoleScriptStream } from '@/hooks/Assistants/useConsoleScriptStream';
import { useActiveTabClaim } from '@/hooks/Assistants/useActiveTabClaim';
import { flashElement } from '@/lib/agent-guidance/flashElement';
import { seedMediaSignedUrls } from '@/lib/client/assistant';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';
import { createAvailableUnityProfile } from '@/utils/assistants/unity-profile-randomizer';
import {
  dispatchCoordinatorOnboardingStepEvent,
  replyStepForCoordinatorTriggerStep,
} from '@/utils/assistants/coordinator-reference-quiz';
import {
  appendRequestSentAck,
  ONBOARDING_START_ACK_STEP_IDS,
} from '@/utils/assistants/request-sent-ack';

const ENABLE_COORDINATOR_ONBOARDING = true;
const COORDINATOR_ONBOARDING_ACCESSIBLE_POLL_MS = 8_000;
const COORDINATOR_ONBOARDING_IDLE_POLL_MS = 30_000;
const COORDINATOR_ONBOARDING_STEP_RETRY_MS = 30_000;
type ContactManagerInitialTab = ContactType | 'slack' | 'ms_teams_bot';

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
    /** Owner scope whose MS Teams bot install can be bound — an org
     *  (owner/admin) or the personal user. Null hides the Teams bot entry. */
    msTeamsBotOwner?: MsTeamsBotInstallOwner | null;
    /** Whether the current user may bind the Teams bot install (org
     *  owner/admin, or the personal-account owner). */
    msTeamsBotCanManage?: boolean;
    /** Server-prefetched current MS Teams bot install for the active owner. */
    msTeamsBotInitialInstall?: MsTeamsBotInstall | null;
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
  const routePathname = usePathname();
  const { navigateTo, navigateToAssistants } = useAppShellNavigation();
  const pendingShellNavigationTarget = usePendingShellNavigationTarget();
  const { pendingAssistantSectionId, clearPendingAssistantSection } =
    usePendingAssistantSectionTarget();
  const pendingTargetPathname = pendingShellNavigationTarget
    ? pathnameFromHref(pendingShellNavigationTarget)
    : null;
  const isAssistantsRouteActive = isAssistantsPath(routePathname);
  const isPendingAssistantsTarget = pendingTargetPathname
    ? isAssistantsPath(pendingTargetPathname)
    : false;
  const isPendingNonAssistantsTarget = pendingTargetPathname
    ? !isAssistantsPath(pendingTargetPathname)
    : false;
  // `Main` is mounted persistently by the app shell and only hidden when the
  // user is on another surface (settings/admin/etc). It must not write to the
  // URL while hidden, or its `?profile=` sync would yank navigation back to
  // `/assistants`. All URL writes target `/assistants` and are gated on this.
  const isActiveSurface =
    isPendingAssistantsTarget || (isAssistantsRouteActive && !isPendingNonAssistantsTarget);
  const canWriteAssistantUrl = isAssistantsRouteActive && pendingShellNavigationTarget === null;
  const pathname = '/assistants';
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

  // --- Org roster, human presence, and org chat (teams + DMs) ---
  // All three are org-workspace concepts: the personal workspace has no
  // humans/teams in the selector and sends no presence heartbeats.
  const activeOrganizationId = activeWorkspace?.type === 'organization' ? activeWorkspace.id : null;
  const { roster, markHumanOnline, refresh: refreshOrgRoster } = useOrgRoster(activeOrganizationId);
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  usePresenceHeartbeat(!!activeOrganizationId);
  const orgChat = useOrgChat({
    orgId: activeOrganizationId,
    currentUserId,
    enabled: !!activeOrganizationId,
    onHumanActivity: markHumanOnline,
  });
  const rosterTeams = React.useMemo(
    () =>
      withOrgNameForManagedTeams(
        withOrgProfileImageForTeams(
          roster?.teams ?? [],
          activeWorkspace?.type === 'organization' ? activeWorkspace.image : null
        ),
        activeWorkspace?.type === 'organization' ? activeWorkspace.name : null
      ),
    [activeWorkspace?.image, activeWorkspace?.name, activeWorkspace?.type, roster?.teams]
  );

  const syncProfileQueryParam = React.useCallback(
    (assistantId: string | null) => {
      if (typeof window === 'undefined') return;
      // Only the visible assistants surface owns the URL. When hidden behind a
      // settings/admin route, skip the write so navigation is not hijacked.
      if (!canWriteAssistantUrl) return;

      const currentProfile = searchParams.get('profile');
      if ((assistantId ?? null) === (currentProfile ?? null)) return;

      const nextParams = new URLSearchParams(searchParams.toString());
      if (assistantId) {
        nextParams.set('profile', assistantId);
      } else {
        nextParams.delete('profile');
      }

      const nextQuery = nextParams.toString();
      const nextUrl = nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [canWriteAssistantUrl, router, searchParams]
  );

  // --- UI Panel Management ---
  const {
    profileAssistantId,
    handleShowProfile: setPanelProfileAssistant,
    handleProfileClose: clearPanelProfileAssistant,
  } = usePanelManager(profileParam);
  // The selection key's string domain covers assistants (bare agent id) plus
  // humans (`human:{userId}`), teams (`team:{teamId}`), and groups
  // (`group:{groupId}`) — see `lib/assistants/selectedEntity`.
  const selectedEntity = React.useMemo(
    () => parseSelectedEntityKey(profileAssistantId),
    [profileAssistantId]
  );
  const selectedEntityKind: SelectorEntityKind = selectedEntity?.kind ?? 'assistant';
  const isNonAssistantSelection = selectedEntityKind !== 'assistant';
  const presenceAssistantId = isNonAssistantSelection ? null : profileAssistantId;
  useAssistantPresenceWake(presenceAssistantId);
  // Console moves arriving outside a Meet, scoped to the same teammate that
  // receives the presence heartbeat: that is the one told the console is open,
  // so it is the only one that can be driving it.
  const consoleNav = React.useMemo(
    () => ({ navigateTo, navigateToAssistants }),
    [navigateTo, navigateToAssistants]
  );
  // Marks this tab as the one to drive while the user is in it, so a script
  // that fans out to every open tab only runs in the one they are watching.
  useActiveTabClaim();
  useConsoleScriptStream({
    assistantId: presenceAssistantId,
    nav: consoleNav,
    highlight: flashElement,
  });
  const handleShowProfile = React.useCallback(
    (assistantId: string) => {
      setPanelProfileAssistant(assistantId);
      writeStoredSelectedAssistantId(assistantId);
      syncProfileQueryParam(assistantId);
    },
    [setPanelProfileAssistant, syncProfileQueryParam]
  );
  React.useEffect(() => {
    if (!isActiveSurface || !profileAssistantId) return;
    syncProfileQueryParam(profileAssistantId);
  }, [isActiveSurface, profileAssistantId, syncProfileQueryParam]);
  const handleProfileClose = React.useCallback(() => {
    clearPanelProfileAssistant();
    writeStoredSelectedAssistantId(null);
    syncProfileQueryParam(null);
  }, [clearPanelProfileAssistant, syncProfileQueryParam]);
  const handleToggleAssistantInfo = React.useCallback(
    (assistantId: string) => {
      if (profileAssistantId !== assistantId) {
        requestAssistantInfoPanelOpenAfterSelect(assistantId);
        handleShowProfile(assistantId);
        return;
      }
      requestAssistantInfoPanelToggle({ assistantId });
    },
    [handleShowProfile, profileAssistantId]
  );

  // Right-pane state lives above the tab host so it survives shell route
  // transitions while the app stays mounted. Reloads and direct landings
  // intentionally start from Chat.
  const RIGHT_PANE_STORAGE_KEY = 'console:assistants:rightPaneState';
  const [paneState, setPaneState] = React.useState<RightPaneState>(DEFAULT_RIGHT_PANE_STATE);

  // Hydrate only same-page-session state. Hard reload clears this key below,
  // so cold `/assistants` entry lands on Chat.
  React.useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(RIGHT_PANE_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<RightPaneState> | null;
      if (!parsed || typeof parsed !== 'object') return;
      const isMobile = window.matchMedia(maxWidthMediaQuery('mobile')).matches;
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
      // Storage may be unavailable (private mode, etc.) — ignore.
    }
  }, []);

  // Persist within the live tab only; remove it before a full page unload so
  // reload/direct entry returns to Chat.
  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(RIGHT_PANE_STORAGE_KEY, JSON.stringify(paneState));
    } catch {
      /* ignore */
    }
  }, [paneState]);

  React.useEffect(() => {
    const clearStoredPaneState = () => {
      try {
        window.sessionStorage.removeItem(RIGHT_PANE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('beforeunload', clearStoredPaneState);
    window.addEventListener('pagehide', clearStoredPaneState);
    return () => {
      window.removeEventListener('beforeunload', clearStoredPaneState);
      window.removeEventListener('pagehide', clearStoredPaneState);
    };
  }, []);

  // Collapse to primary-only on viewport shrink to mobile so a stored
  // split doesn't suddenly look broken when the user resizes their window.
  React.useEffect(() => {
    const mql = window.matchMedia(maxWidthMediaQuery('mobile'));
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setPaneState((prev) => (prev.secondary ? { ...prev, secondary: null } : prev));
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // --- Rail shell state ---
  // The active rail section is derived: for `view` sections the id equals the
  // right-pane tab, so we read it straight off `paneState`. Brain sections that
  // don't map to a right-pane tab — `brain-view` (dedicated component) and
  // `placeholder` ("coming soon") — can't be derived from `paneState`, so they
  // are tracked separately and take precedence while open.
  const [activeBrainSectionId, setActiveBrainSectionId] = React.useState<string | null>(null);

  // A `?action=` deep link (Actions → "Open in new tab") would otherwise land
  // on Chat, since pane state hydrates to Chat on a direct entry. Declared
  // after that hydration effect so it wins the mount pass. The Actions body
  // reads the same param and opens the named root in its focus overlay.
  React.useEffect(() => {
    if (!readActionDeepLink()) return;
    setActiveBrainSectionId(null);
    setPaneState((prev) => ({ ...prev, primary: { tab: 'actions' }, secondary: null }));
  }, []);

  const activeSectionId = activeBrainSectionId ?? paneState.primary.tab;
  const activeSectionDef = SECTION_BY_ID[activeSectionId] ?? SECTION_BY_ID[DEFAULT_SECTION_ID];
  const [hasVisitedBrainSection, setHasVisitedBrainSection] = React.useState(false);

  React.useEffect(() => {
    if (!pendingAssistantSectionId) return;

    const section = SECTION_BY_ID[pendingAssistantSectionId];
    clearPendingAssistantSection();
    if (!section || section.kind === 'action') return;

    if (section.kind === 'brain-view' || section.kind === 'placeholder') {
      setActiveBrainSectionId(section.id);
      return;
    }

    const tab = section.tab;
    if (tab) {
      setActiveBrainSectionId(null);
      setPaneState((prev) => ({ ...prev, primary: { tab } }));
    }
  }, [clearPendingAssistantSection, pendingAssistantSectionId]);

  React.useEffect(() => {
    if (activeSectionDef.kind === 'brain-view') {
      setHasVisitedBrainSection(true);
    }
  }, [activeSectionDef.kind]);

  const { isBelowMobile, isBelowTablet } = useBreakpoint();
  const [mobileRailOpen, setMobileRailOpen] = React.useState(false);
  const [railCollapsed, setRailCollapsed] = React.useState(false);
  React.useEffect(() => {
    const stored = window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY);
    if (stored !== null) {
      setRailCollapsed(stored === '1');
    } else if (window.matchMedia(maxWidthMediaQuery('tablet')).matches) {
      setRailCollapsed(true);
    }
  }, []);
  React.useEffect(() => {
    if (isBelowTablet) {
      setRailCollapsed(true);
    }
  }, [isBelowTablet]);
  React.useEffect(() => {
    if (!isBelowMobile) {
      setMobileRailOpen(false);
    }
  }, [isBelowMobile]);
  const handleRailCollapsedChange = React.useCallback((collapsed: boolean) => {
    setRailCollapsed(collapsed);
    window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  }, []);

  // Convenience: chat is "visible" if either slot is showing it. Used by
  // the chat-stream hook below to suppress unread bumps and by the
  // mark-as-read effect to clear the badge when an assistant is opened.
  const isChatVisibleInRightPane =
    paneState.primary.tab === 'chat' ||
    (paneState.secondary !== null && paneState.secondary.tab === 'chat');
  // Match the rail's active section, not raw pane slots — a split secondary
  // Chat tab must not suppress the floater while Tasks/Actions/etc. is selected.
  const isFullPageAssistantChatVisible = activeSectionId === 'chat';

  const [floatingChatExpanded, setFloatingChatExpanded] = React.useState(false);
  const handleFloatingChatExpandedChange = React.useCallback((expanded: boolean) => {
    setFloatingChatExpanded(expanded);
  }, []);

  // --- Assistant Data & Actions ---
  const {
    assistants,
    setAssistants,
    isLoading: isLoadingAssistants,
    isInitialLoading: isInitialLoadingAssistants,
    isRefreshing: isRefreshingAssistants,
    hasSettledOnce: hasSettledAssistants,
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

  // Human/team selections keep a lightweight section id. On entity switches we
  // carry the currently visible section when it still applies; otherwise Chat.
  const [entitySectionId, setEntitySectionId] = React.useState<string>(DEFAULT_SECTION_ID);
  const { clearUnread: clearOrgChatUnread } = orgChat;

  const applyAssistantSection = React.useCallback((sectionId: string) => {
    const section = SECTION_BY_ID[sectionId] ?? SECTION_BY_ID[DEFAULT_SECTION_ID];
    if (section.kind === 'brain-view' || section.kind === 'placeholder') {
      setActiveBrainSectionId(section.id);
      return;
    }
    setActiveBrainSectionId(null);
    if (section.tab) {
      const tab = section.tab;
      setPaneState((prev) => ({ ...prev, primary: { tab } }));
    }
  }, []);

  const handleAssistantListSelect = React.useCallback(
    (assistantId: string) => {
      if (assistantId === profileAssistantId) {
        if (canonicalCoordinatorId && assistantId !== canonicalCoordinatorId) {
          if (isNonAssistantSelection) {
            applyAssistantSection(resolveSectionForEntity(entitySectionId, 'assistant'));
          }
          handleShowProfile(canonicalCoordinatorId);
        }
        return;
      }

      if (isNonAssistantSelection) {
        applyAssistantSection(resolveSectionForEntity(entitySectionId, 'assistant'));
      }
      handleShowProfile(assistantId);
    },
    [
      applyAssistantSection,
      canonicalCoordinatorId,
      entitySectionId,
      handleShowProfile,
      isNonAssistantSelection,
      profileAssistantId,
    ]
  );

  const handleSelectHuman = React.useCallback(
    (userId: string) => {
      const currentSectionId = isNonAssistantSelection ? entitySectionId : activeSectionId;
      setEntitySectionId(resolveSectionForEntity(currentSectionId, 'human'));
      clearOrgChatUnread(humanEntityKey(userId));
      handleShowProfile(humanEntityKey(userId));
    },
    [
      activeSectionId,
      clearOrgChatUnread,
      entitySectionId,
      handleShowProfile,
      isNonAssistantSelection,
    ]
  );
  const handleSelectTeam = React.useCallback(
    (teamId: number) => {
      const currentSectionId = isNonAssistantSelection ? entitySectionId : activeSectionId;
      setEntitySectionId(resolveSectionForEntity(currentSectionId, 'team'));
      clearOrgChatUnread(teamEntityKey(teamId));
      handleShowProfile(teamEntityKey(teamId));
    },
    [
      activeSectionId,
      clearOrgChatUnread,
      entitySectionId,
      handleShowProfile,
      isNonAssistantSelection,
    ]
  );
  const handleSelectGroup = React.useCallback(
    (groupId: number) => {
      const currentSectionId = isNonAssistantSelection ? entitySectionId : activeSectionId;
      setEntitySectionId(resolveSectionForEntity(currentSectionId, 'group'));
      clearOrgChatUnread(groupEntityKey(groupId));
      handleShowProfile(groupEntityKey(groupId));
    },
    [
      activeSectionId,
      clearOrgChatUnread,
      entitySectionId,
      handleShowProfile,
      isNonAssistantSelection,
    ]
  );

  const selectedHuman = React.useMemo(() => {
    if (selectedEntity?.kind !== 'human' || !roster) return null;
    return roster.humans.find((human) => human.userId === selectedEntity.userId) ?? null;
  }, [roster, selectedEntity]);
  const selectedTeam = React.useMemo(() => {
    if (selectedEntity?.kind !== 'team') return null;
    return rosterTeams.find((team) => team.teamId === selectedEntity.teamId) ?? null;
  }, [rosterTeams, selectedEntity]);
  const rosterGroups = React.useMemo(() => roster?.groups ?? [], [roster?.groups]);
  const selectedGroup = React.useMemo(() => {
    if (selectedEntity?.kind !== 'group') return null;
    return rosterGroups.find((group) => group.groupId === selectedEntity.groupId) ?? null;
  }, [rosterGroups, selectedEntity]);

  // Human/team/group selections are org-only. Clear them in personal workspace
  // (including leftover localStorage / URL restores) and when the settled org
  // roster no longer contains the entity.
  React.useEffect(() => {
    if (!isNonAssistantSelection) return;
    const resolution = resolveOrgEntitySelection({
      entity: selectedEntity,
      organizationId: activeOrganizationId,
      roster,
    });
    if (resolution !== 'clear') return;
    if (canonicalCoordinatorId) {
      handleShowProfile(canonicalCoordinatorId);
    } else {
      handleProfileClose();
    }
  }, [
    activeOrganizationId,
    canonicalCoordinatorId,
    handleProfileClose,
    handleShowProfile,
    isNonAssistantSelection,
    roster,
    selectedEntity,
  ]);

  // Coordinator onboarding intro gate: on a fresh visit with active
  // onboarding and the intro not yet watched we overlay the call-vs-chat
  // picker on top of the regular /assistants shell. The layout itself
  // never swaps — once the overlay dismisses the user is in the full
  // platform with the onboarding checklist in the Coordinator's
  // "Assistant info" panel.
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
  // Set when the user picks chat on the onboarding overlay; drives a one-shot
  // forced typing bubble until the scripted opener lands (see chat panel prop).
  const [awaitingCoordinatorChatIntro, setAwaitingCoordinatorChatIntro] = React.useState(false);
  const [showCoordinatorChatIntroTyping, setShowCoordinatorChatIntroTyping] = React.useState(false);
  // Global "do onboarding later" switch. When set, the whole Console
  // onboarding surface (intro overlay, focus layout, nudge dot) stands
  // down so the user can use the platform first — mirrored to the
  // Coordinator's prompts server-side. Per-step state is untouched.
  const isCoordinatorOnboardingActive = coordinatorOnboardingState?.onboardingActive === true;
  const handleOpenChatSection = React.useCallback(() => {
    setActiveBrainSectionId(null);
    setPaneState((prev) =>
      prev.primary.tab === 'chat' && prev.secondary === null
        ? prev
        : {
            ...prev,
            primary: { tab: 'chat' },
            secondary: null,
          }
    );
  }, []);
  const {
    beginAppsConnectFlow,
    onConnectSettled: onAppsConnectSettled,
    appsConnectSettling,
  } = useCoordinatorAppsConnectFlow({
    coordinatorId: canonicalCoordinatorId,
    enabled: isCanonicalCoordinatorOwned && isCoordinatorOnboardingActive,
    completedStepIds: coordinatorOnboardingState?.completedStepIds,
    refreshAssistants,
    refetchCoordinatorOnboardingState,
    updateCoordinatorOnboardingState,
    onOpenChatSection: handleOpenChatSection,
  });
  useCoordinatorOnboardingInvalidation(
    canonicalCoordinator?.agentId ?? null,
    isCanonicalCoordinatorOwned && isCoordinatorOnboardingActive,
    () => {
      void refetchCoordinatorOnboardingState();
      onAppsConnectSettled();
    }
  );
  const showCoordinatorOnboardingIntro =
    ENABLE_COORDINATOR_ONBOARDING &&
    isCanonicalCoordinatorOwned &&
    !coordinatorIntroDismissed &&
    isCoordinatorOnboardingActive &&
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
  const requestCoordinatorOnboardingInfoClose = React.useCallback(() => {
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
      const resetAppsIntegrations = async () => {
        if (resetStepId !== APPS_ONBOARDING_STEP_ID || canonicalCoordinatorId == null) {
          return;
        }
        const disconnectedIds = await disconnectConnectedIntegrationsForAppsReset({
          coordinatorId: canonicalCoordinatorId,
        });
        if (disconnectedIds.length > 0) {
          broadcastIntegrationDisconnectSettled({
            assistantId: String(canonicalCoordinatorId),
            reason: 'apps_step_reset',
            connectionIds: disconnectedIds,
          });
        }
      };
      if (resetStepId) {
        void (async () => {
          try {
            await resetAppsIntegrations();
            await updateCoordinatorOnboardingState({ resetOnboardingStep: resetStepId });
          } catch (error) {
            console.error('Failed to reset onboarding step', error);
          }
        })();
      } else if (activeCoordinatorOnboardingStep && ids.has(activeCoordinatorOnboardingStep)) {
        void updateCoordinatorOnboardingState({ clearOnboardingStep: true });
      }
    },
    [
      activeCoordinatorOnboardingStep,
      canonicalCoordinatorId,
      clearStepRequests,
      updateCoordinatorOnboardingState,
    ]
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
  const collectCompletionBlockedStepIds = React.useCallback(
    (stepId: string): string[] => {
      const steps = coordinatorOnboardingState?.onboarding?.steps ?? [];
      const result = [stepId];
      const seen = new Set(result);
      let changed = true;
      while (changed) {
        changed = false;
        for (const step of steps) {
          if (seen.has(step.id)) continue;
          if (
            step.dependencies.some(
              (dependency) => dependency.resolution === 'completed' && seen.has(dependency.id)
            )
          ) {
            seen.add(step.id);
            result.push(step.id);
            changed = true;
          }
        }
      }
      return result;
    },
    [coordinatorOnboardingState?.onboarding?.steps]
  );
  const collectCompletionCoupledStepIds = React.useCallback(
    (stepId: string): string[] => {
      const steps = coordinatorOnboardingState?.onboarding?.steps ?? [];
      const coupled = new Set<string>([stepId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const step of steps) {
          if (!coupled.has(step.id)) continue;
          for (const dependency of step.dependencies) {
            if (dependency.resolution === 'completed' && !coupled.has(dependency.id)) {
              coupled.add(dependency.id);
              changed = true;
            }
          }
        }
      }
      for (const coupledStepId of Array.from(coupled)) {
        for (const blockedStepId of collectCompletionBlockedStepIds(coupledStepId)) {
          coupled.add(blockedStepId);
        }
      }
      return steps.filter((step) => coupled.has(step.id)).map((step) => step.id);
    },
    [collectCompletionBlockedStepIds, coordinatorOnboardingState?.onboarding?.steps]
  );
  const handleCoordinatorOnboardingStepSkip = React.useCallback(
    async (stepId: string) => {
      const cascadeStepIds = collectCompletionBlockedStepIds(stepId);
      for (const cascadeStepId of cascadeStepIds) markStepSkipped(cascadeStepId);
      const skipped = await updateCoordinatorOnboardingState({ skipOnboardingStep: stepId });
      if (!skipped) {
        for (const cascadeStepId of cascadeStepIds) markStepUnskipped(cascadeStepId);
      }
    },
    [
      collectCompletionBlockedStepIds,
      markStepSkipped,
      markStepUnskipped,
      updateCoordinatorOnboardingState,
    ]
  );
  const handleCoordinatorOnboardingStepUnskip = React.useCallback(
    async (stepId: string) => {
      const cascadeStepIds = collectCompletionCoupledStepIds(stepId);
      for (const cascadeStepId of cascadeStepIds) markStepUnskipped(cascadeStepId);
      const unskipped = await updateCoordinatorOnboardingState({ unskipOnboardingStep: stepId });
      if (!unskipped) {
        for (const cascadeStepId of cascadeStepIds) markStepSkipped(cascadeStepId);
      }
    },
    [
      collectCompletionCoupledStepIds,
      markStepSkipped,
      markStepUnskipped,
      updateCoordinatorOnboardingState,
    ]
  );
  const setCoordinatorOnboardingActive = React.useCallback(
    (active: boolean) => {
      void updateCoordinatorOnboardingState({ onboardingActive: active });
    },
    [updateCoordinatorOnboardingState]
  );

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
      onboardingActive: isCoordinatorOnboardingActive,
      setOnboardingActive: setCoordinatorOnboardingActive,
      onboarding: coordinatorOnboardingState?.onboarding ?? null,
      firstLoginCommunicationEmailOpenRequest,
      acknowledgeFirstLoginCommunicationEmailOpen,
      appsConnectSettling,
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
      isCoordinatorOnboardingActive,
      setCoordinatorOnboardingActive,
      coordinatorOnboardingState?.onboarding,
      firstLoginCommunicationEmailOpenRequest,
      acknowledgeFirstLoginCommunicationEmailOpen,
      appsConnectSettling,
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
    ((isInitialLoadingAssistants && !canonicalCoordinator) ||
      (isCanonicalCoordinatorOwned &&
        coordinatorOnboardingState === null &&
        isCoordinatorOnboardingStateLoading));

  const assistantsBootstrappedRef = React.useRef(false);
  if (!isCoordinatorOnboardingResolvePending) {
    assistantsBootstrappedRef.current = true;
  }
  const showAssistantContentSkeleton =
    canWriteAssistantUrl &&
    !hasSettledAssistants &&
    isCoordinatorOnboardingResolvePending &&
    !assistantsBootstrappedRef.current;

  React.useEffect(() => {
    debugConsole('coordinator-onboarding', 'gate.evaluate', {
      canonicalCoordinatorId,
      hasCanonicalCoordinator: !!canonicalCoordinator,
      isLoadingAssistants,
      isCanonicalCoordinatorOwned,
      isCoordinatorOnboardingStateLoading,
      hasCoordinatorOnboardingState: coordinatorOnboardingState !== null,
      onboardingActive: coordinatorOnboardingState?.onboardingActive ?? null,
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
  const callContext = useCallContext();
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
    activeOpeningConfig,
    waitingMessage,
    connectionError,
    retryConnection,
    isDesktopEnabled,
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
  } = callContext;

  // Human/team/group calls run on the same unified engine.
  const humanCall = callContext;

  // One engine, so one answer about its availability. Every call surface reads
  // these; the wording per surface comes from ``resolveCallGate``.
  const callGateInputs = React.useMemo(
    () => ({
      voiceCallsEnabled: humanCall.voiceCallsEnabled,
      hasActiveAssistantCall: !!activeCallAssistant,
      isConnecting: humanCall.isConnecting,
      isConnected: humanCall.isConnected,
      activeCall: humanCall.activeCall,
    }),
    [
      activeCallAssistant,
      humanCall.activeCall,
      humanCall.isConnected,
      humanCall.isConnecting,
      humanCall.voiceCallsEnabled,
    ]
  );
  const dmCallGate = resolveCallGate({ kind: 'human' }, callGateInputs);

  const wasAssistantsSurfaceActiveRef = React.useRef(isActiveSurface);
  React.useEffect(() => {
    const wasActive = wasAssistantsSurfaceActiveRef.current;
    wasAssistantsSurfaceActiveRef.current = isActiveSurface;
    if (!wasActive && isActiveSurface && activeCallAssistant) {
      redock();
    }
  }, [activeCallAssistant, isActiveSurface, redock]);

  React.useEffect(() => {
    if (!profileAssistantId || isLoadingAssistants) return;
    // Human/team selections are validated against the roster, not the
    // assistant list — see the entity fallback effect above.
    if (isNonAssistantEntityKey(profileAssistantId)) return;
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

    // Brain sections replace the chat/info pane entirely, so route back to
    // Chat before opening the Coordinator onboarding panel.
    setActiveBrainSectionId(null);
    setPaneState((prev) => ({
      ...prev,
      primary: { tab: 'chat' },
      secondary: null,
    }));
    handleShowProfile(canonicalCoordinatorId);
    if (onboardingFocusParam.startsWith('close:')) {
      requestCoordinatorOnboardingInfoClose();
    } else {
      requestCoordinatorOnboardingFocusLayout();
      requestFirstLoginCommunicationEmailOpen();
    }

    if (canWriteAssistantUrl) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('onboarding');
      const nextQuery = nextParams.toString();
      router.replace(nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [
    canonicalCoordinatorId,
    canWriteAssistantUrl,
    handleShowProfile,
    isLoadingAssistants,
    onboardingFocusParam,
    pathname,
    requestCoordinatorOnboardingFocusLayout,
    requestCoordinatorOnboardingInfoClose,
    requestFirstLoginCommunicationEmailOpen,
    router,
    searchParams,
  ]);

  // Report the outcome of a one-click Teams connect. `/connect/ms-teams` has
  // already bound the install server-side by the time this page renders, so the
  // seeded install is current and all that is left is telling the user and
  // clearing the notice.
  //
  // Read from `window.location` rather than `useSearchParams`, and clear with the
  // History API rather than `router.replace`: the notice must settle even on a
  // load where this surface is hidden or the router state lags the address bar.
  const consumedMsTeamsConnectFlashRef = React.useRef(false);
  React.useEffect(() => {
    if (consumedMsTeamsConnectFlashRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const connected = params.get(MS_TEAMS_BOT_CONNECTED_PARAM);
    const errorCode = params.get(MS_TEAMS_BOT_CONNECT_ERROR_PARAM);
    if (!connected && !errorCode) return;
    consumedMsTeamsConnectFlashRef.current = true;

    if (connected) {
      toast.success(
        userMeta.msTeamsBotOwner?.kind === 'org'
          ? 'Microsoft Teams connected to your organization.'
          : 'Microsoft Teams connected to your account.'
      );
      void refetchCoordinatorOnboardingState();
    } else {
      toast.error(msTeamsBotConnectErrorMessage(errorCode));
    }

    params.delete(MS_TEAMS_BOT_CONNECTED_PARAM);
    params.delete(MS_TEAMS_BOT_CONNECT_ERROR_PARAM);
    const nextQuery = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      nextQuery.length > 0 ? `${window.location.pathname}?${nextQuery}` : window.location.pathname
    );
  }, [refetchCoordinatorOnboardingState, userMeta.msTeamsBotOwner]);

  // Opening onboarding from the top bar switches the selection to the
  // Coordinator. When another teammate is selected that switch is not what the
  // user asked for, so it is confirmed first rather than applied silently.
  const [pendingOnboardingPanelAction, setPendingOnboardingPanelAction] = React.useState<
    CoordinatorOnboardingPanelRequestDetail['action'] | null
  >(null);

  const applyCoordinatorOnboardingPanelRequest = React.useCallback(
    (action: CoordinatorOnboardingPanelRequestDetail['action']) => {
      if (!canonicalCoordinatorId) return;

      setActiveBrainSectionId(null);
      setPaneState((prev) => ({
        ...prev,
        primary: { tab: 'chat' },
        secondary: null,
      }));
      handleShowProfile(canonicalCoordinatorId);

      if (action === 'close') {
        requestCoordinatorOnboardingInfoClose();
        return;
      }

      requestCoordinatorOnboardingFocusLayout();
      requestFirstLoginCommunicationEmailOpen();
      requestAssistantInfoPanelOpen(canonicalCoordinatorId);
    },
    [
      canonicalCoordinatorId,
      handleShowProfile,
      requestCoordinatorOnboardingFocusLayout,
      requestCoordinatorOnboardingInfoClose,
      requestFirstLoginCommunicationEmailOpen,
    ]
  );

  React.useEffect(() => {
    const onCoordinatorOnboardingPanelRequest = (event: Event) => {
      const detail = (event as CustomEvent<CoordinatorOnboardingPanelRequestDetail>).detail;
      if (!detail?.assistantId || !canonicalCoordinatorId) return;
      if (detail.assistantId !== canonicalCoordinatorId) return;
      if (isLoadingAssistants) return;

      if (profileAssistantId && profileAssistantId !== canonicalCoordinatorId) {
        setPendingOnboardingPanelAction(detail.action);
        return;
      }

      applyCoordinatorOnboardingPanelRequest(detail.action);
    };

    window.addEventListener(
      COORDINATOR_ONBOARDING_PANEL_REQUEST_EVENT,
      onCoordinatorOnboardingPanelRequest
    );
    return () => {
      window.removeEventListener(
        COORDINATOR_ONBOARDING_PANEL_REQUEST_EVENT,
        onCoordinatorOnboardingPanelRequest
      );
    };
  }, [
    applyCoordinatorOnboardingPanelRequest,
    canonicalCoordinatorId,
    isLoadingAssistants,
    profileAssistantId,
  ]);

  const confirmOnboardingPanelSelectionSwitch = React.useCallback(() => {
    const action = pendingOnboardingPanelAction;
    setPendingOnboardingPanelAction(null);
    if (action) applyCoordinatorOnboardingPanelRequest(action);
  }, [applyCoordinatorOnboardingPanelRequest, pendingOnboardingPanelAction]);

  // --- Assistant Status Polling ---
  const { statuses: assistantStatuses, markOnline: markAssistantOnline } = useAssistantStatus(
    assistants,
    { enabled: isActiveSurface }
  );

  // --- Billing Status & Credit Grant Link ---
  const {
    credits,
    accountStatus,
    billingMode,
    isBalanceKnown,
    isLoading: isBillingLoading,
    refetch: refetchBillingStatus,
    startPolling: startBillingPolling,
  } = useBillingStatus({ enabled: isActiveSurface });
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
  const [isEditFormReady, setIsEditFormReady] = React.useState(false);
  const [contactManagerAssistant, setContactManagerAssistant] = React.useState<Assistant | null>(
    null
  );
  const [contactManagerInitialTab, setContactManagerInitialTab] =
    React.useState<ContactManagerInitialTab>('email');
  const [workspaceManagerAssistant, setWorkspaceManagerAssistant] =
    React.useState<Assistant | null>(null);
  const [brainManagerAssistant, setBrainManagerAssistant] = React.useState<Assistant | null>(null);
  const [computerUseManagerAssistant, setComputerUseManagerAssistant] =
    React.useState<Assistant | null>(null);
  const [workspaceManagerInitialProvider, setWorkspaceManagerInitialProvider] =
    React.useState<OAuthProvider | null>(null);
  // Bumped whenever the workspace manager closes. Surfaces whose state is
  // derived from the connection — the Workflows shelf reads it as a secret —
  // re-read on the change instead of showing a connected Workspace as unmet.
  const [workspaceSettledSignal, setWorkspaceSettledSignal] = React.useState(0);
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
  const [requestAckHistories, setRequestAckHistories] = React.useState<
    Record<string, RequestSentAck[]>
  >({});

  React.useEffect(() => {
    if (!awaitingCoordinatorChatIntro) {
      setShowCoordinatorChatIntroTyping(false);
      return;
    }
    const handle = window.setTimeout(
      () => setShowCoordinatorChatIntroTyping(true),
      COORDINATOR_ONBOARDING_CHAT_INTRO_TYPING_DELAY_MS
    );
    return () => window.clearTimeout(handle);
  }, [awaitingCoordinatorChatIntro]);

  React.useEffect(() => {
    if (!awaitingCoordinatorChatIntro || canonicalCoordinatorId === null) return;
    const messages = profileChatHistories[String(canonicalCoordinatorId)] ?? [];
    if (messages.some((message) => message.role === 'assistant')) {
      setAwaitingCoordinatorChatIntro(false);
    }
  }, [awaitingCoordinatorChatIntro, canonicalCoordinatorId, profileChatHistories]);

  React.useEffect(() => {
    if (!awaitingCoordinatorChatIntro) return;
    const handle = window.setTimeout(
      () => setAwaitingCoordinatorChatIntro(false),
      COORDINATOR_ONBOARDING_CHAT_INTRO_TYPING_FALLBACK_MS
    );
    return () => window.clearTimeout(handle);
  }, [awaitingCoordinatorChatIntro]);

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
  // status via `handleAssistantLiveActivity` (any inbound SSE frame,
  // including call_incoming rings, plus call-connect fallbacks).
  //
  // Pairs are assembled from the `resolvedContactIds` state that
  // `useContactIdPrefetch` maintains; as new IDs resolve, React batches the
  // updates and the stream reconnects once per render pass rather than once
  // per network response.
  // One pair per assistant: unified chat-store frames are published once per
  // assistant topic (no per-root fan-out), demuxed client-side by the DM
  // thread's `user_id`.
  const chatStreamPairs = React.useMemo<ChatStreamPair[]>(
    () =>
      chatReadableAssistants.flatMap((a) => {
        const cid = resolvedContactIds[a.agentId];
        if (cid === undefined) return [];
        return [
          {
            assistantId: a.agentId,
            contactId: cid,
            rootKey: 'personal',
            sourceContext: '',
          },
        ];
      }),
    [chatReadableAssistants, resolvedContactIds]
  );

  // Per-assistant monotonic counter bumped on every inbound SSE frame.
  // Consumed by the chat panel (via props) to clear its typing indicator
  // when the assistant starts replying.
  const [chatActivityCounters, setChatActivityCounters] = React.useState<Record<string, number>>(
    {}
  );
  const handleChatActivity = React.useCallback(
    (assistantId: string) => {
      setChatActivityCounters((prev) => ({
        ...prev,
        [assistantId]: (prev[assistantId] ?? 0) + 1,
      }));
      if (canonicalCoordinatorId !== null && assistantId === String(canonicalCoordinatorId)) {
        void refetchCoordinatorOnboardingState();
      }
    },
    [canonicalCoordinatorId, refetchCoordinatorOnboardingState]
  );

  const handleAssistantLiveActivity = React.useCallback(
    (assistantId: string) => {
      handleChatActivity(assistantId);
      markAssistantOnline(assistantId);
    },
    [handleChatActivity, markAssistantOnline]
  );

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
      type MergeOutcome = 'skipped_no_history' | 'duplicate' | 'upgraded' | 'merged';
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
        // A user-authored frame with a server id is usually the echo of this
        // client's own optimistic send (or a sibling tab's, relayed over
        // BroadcastChannel). The optimistic copy carries a local uuid and no
        // messageId, so the id dedup above can't catch it — match it by
        // content and upgrade it in place with the persisted identity
        // instead of appending a duplicate bubble.
        if (hasServerMessageId && message.role === 'user') {
          const optimisticIndex = current.findIndex(
            (m) => m.role === 'user' && m.messageId === undefined && m.content === message.content
          );
          if (optimisticIndex !== -1) {
            outcomeRef.value = 'upgraded';
            const updated = [...current];
            // Keep the optimistic (clamped) timestamp so the bubble doesn't
            // jump; adopt the server id so reactions and future dedup work.
            updated[optimisticIndex] = {
              ...message,
              timestamp: updated[optimisticIndex].timestamp,
            };
            return { ...prev, [assistantId]: updated };
          }
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

      // Upgraded echoes stay local: sibling tabs receive their own SSE copy
      // and upgrade their own optimistic bubble the same way.
      if (mergeOutcome === 'duplicate' || mergeOutcome === 'upgraded') return;

      if (mergeOutcome === 'merged' && message.role === 'assistant') {
        handleChatActivity(assistantId);
        if (message.messageId === undefined) {
          requestReconcileRef.current(assistantId);
        }
      }

      // Mark the assistant as "online" in the list — an incoming message
      // is the strongest possible signal the process is reachable. This
      // applies to both merged and skipped-no-history cases.
      markAssistantOnline(assistantId);

      // Broadcast to sibling tabs so a second tab with the same chat open
      // can render the message without waiting for its own SSE copy.
      // Skipped-no-history doesn't broadcast: the receiving
      // tab's chat panel (if any) would face the same SSE-id vs
      // log-entry-id mismatch and end up with a phantom duplicate. Tabs
      // with the chat open will pick the message up either via their own
      // direct SSE delivery or via the in-panel polling reconciler.
      if (mergeOutcome !== 'merged') return;

      const broadcastMsg = { ...message };
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
    [handleChatActivity, markAssistantOnline]
  );

  const handleChatStreamReaction = React.useCallback(
    (assistantId: string, parsed: ParsedReactionUpdate) => {
      setProfileChatHistories((prev) => {
        const current = prev[assistantId];
        if (!current) return prev;
        const index = current.findIndex((msg) => msg.messageId === parsed.targetMessageId);
        if (index === -1) return prev;
        const updated = [...current];
        updated[index] = {
          ...updated[index],
          reactions: parsed.reactions,
        };
        return { ...prev, [assistantId]: updated };
      });

      try {
        const channel = new BroadcastChannel(`assistant-chat-sync-${assistantId}`);
        const payload: BroadcastMessagePayload = {
          type: 'REACTION_UPDATE',
          targetMessageId: parsed.targetMessageId,
          reactions: parsed.reactions,
        };
        channel.postMessage(payload);
        channel.close();
      } catch {
        /* BroadcastChannel unsupported */
      }
    },
    []
  );

  const handleChatStreamDesktopReady = React.useCallback(
    (assistantId: string, eventData: Record<string, unknown>) => {
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

  // The assistant rang the owner on Unify Meet: a ringing assistant_dm call
  // session. We show a pinned incoming-call card; answering answers the
  // session through the unified engine. Answered/ended/declined frames from
  // other tabs or the ring timeout clear the card.
  const [incomingMeetCall, setIncomingMeetCall] = React.useState<{
    assistant: Assistant;
    callSessionId: string;
  } | null>(null);
  // Fan-out can deliver the same ring to multiple live connections (tabs /
  // brief reconnect overlap). Dedupe by call session id within this tab.
  const seenMeetRingSessionIdsRef = React.useRef<Set<string>>(new Set());

  const handleAssistantCallFrame = React.useCallback(
    (
      assistantId: string,
      action: 'incoming' | 'answered' | 'ended' | 'declined',
      eventData: Record<string, unknown>
    ) => {
      const callSessionId = typeof eventData.call_id === 'string' ? eventData.call_id : '';
      if (!callSessionId) return;
      if (action === 'incoming') {
        // Only assistant-initiated rings surface the pinned card.
        if (eventData.created_by_assistant_id == null) return;
        const assistant = assistants.find((a) => a.agentId === assistantId);
        if (!assistant) return;
        if (seenMeetRingSessionIdsRef.current.has(callSessionId)) return;
        seenMeetRingSessionIdsRef.current.add(callSessionId);
        setIncomingMeetCall({ assistant, callSessionId });
        return;
      }
      // answered (possibly in another tab), ended (ring timeout), declined.
      setIncomingMeetCall((prev) => (prev && prev.callSessionId === callSessionId ? null : prev));
    },
    [assistants]
  );

  const {
    connectionStatusByAssistant: chatStreamConnectionStatusByAssistant,
    reconnect: reconnectChatStream,
    unreadCounts: chatStreamUnreadCounts,
    markAsRead: markChatStreamRead,
  } = useAssistantChatStream(
    chatStreamPairs,
    chatStreamPairs.length > 0,
    {
      onChatMessage: handleChatStreamMessage,
      onReactionUpdate: handleChatStreamReaction,
      onDesktopReady: handleChatStreamDesktopReady,
      onCallFrame: handleAssistantCallFrame,
      onMessageActivity: handleAssistantLiveActivity,
    },
    {
      userEmail: userMeta.email ?? undefined,
      userId: currentUserId ?? undefined,
      // Suppress unread bumps for whichever assistant chat the user is
      // currently looking at — either the profile chat panel (only when
      // the right-pane Chat tab is visible in *either* the primary or
      // secondary split slot; on Actions/Brain/etc.-only we still want
      // the badge to climb so the user notices), or, if no panel is
      // open, the call dialog's embedded side panel.
      activeAssistantId:
        (isChatVisibleInRightPane ? profileAssistantId : null) ??
        (floatingChatExpanded &&
        profileAssistantId &&
        !isHireDialogOpen &&
        !showCoordinatorOnboardingIntro
          ? profileAssistantId
          : null) ??
        activeCallAssistant?.agentId ??
        null,
      getCutoff: getChatStreamCutoff,
    }
  );
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
  const { requestReconcile } = useAssistantTranscriptReconciler({
    pairs: reconcilerPairs,
    connectionStatusByAssistant: chatStreamConnectionStatusByAssistant,
    activeAssistantId:
      (isChatVisibleInRightPane ? profileAssistantId : null) ??
      (floatingChatExpanded &&
      profileAssistantId &&
      !isHireDialogOpen &&
      !showCoordinatorOnboardingIntro
        ? profileAssistantId
        : null) ??
      activeCallAssistant?.agentId ??
      null,
    enabled: isActiveSurface && reconcilerPairs.length > 0,
    chatHistories: profileChatHistories,
    setChatHistories: setProfileChatHistories,
  });
  const requestReconcileRef = React.useRef(requestReconcile);
  requestReconcileRef.current = requestReconcile;

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
    if (isActiveSurface && profileAssistantId && isChatVisibleInRightPane) {
      markChatStreamRead(profileAssistantId);
    }
    if (
      profileAssistantId &&
      floatingChatExpanded &&
      !isChatVisibleInRightPane &&
      !isHireDialogOpen &&
      !showCoordinatorOnboardingIntro
    ) {
      markChatStreamRead(profileAssistantId);
    }
  }, [
    isActiveSurface,
    profileAssistantId,
    isChatVisibleInRightPane,
    floatingChatExpanded,
    isHireDialogOpen,
    showCoordinatorOnboardingIntro,
    markChatStreamRead,
  ]);

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
      enablePolling: isActiveSurface,
    }),
    [disabledAction, isActiveSurface]
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
      enablePolling: isActiveSurface,
    };
  }, [userMeta.orgId, disabledAction, isActiveSurface]);

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

      markAssistantOnline(assistant.agentId);

      // Fresh call: stay docked by default.
      redock();
      await startCall(assistant, callType, options);
    },
    [startCall, redock, activeCallAssistant, markAssistantOnline]
  );

  const handleHangUp = React.useCallback(async () => {
    await hangUpCall();
  }, [hangUpCall]);

  const handleAnswerIncomingMeet = React.useCallback(() => {
    if (!incomingMeetCall) return;
    const { assistant, callSessionId } = incomingMeetCall;
    setIncomingMeetCall(null);
    handleShowProfile(assistant.agentId);
    // Answering the session triggers Orchestra's dispatch, which replays the
    // opening config the assistant stored on the ring; the client-side hint
    // only shapes the ready-to-speak phase gating.
    const openingConfig: CallOpeningConfig = {
      mode: 'opener',
      openerText: '',
      source: 'unify_meet_ring',
    };
    void handleStartCall(assistant, 'audio', {
      openingConfig,
      callSessionId,
      waitForAssistantReady: true,
    });
  }, [incomingMeetCall, handleShowProfile, handleStartCall]);

  const handleDeclineIncomingMeet = React.useCallback(() => {
    const declining = incomingMeetCall;
    setIncomingMeetCall(null);
    if (declining?.callSessionId) {
      fetch(`/api/calls/${encodeURIComponent(declining.callSessionId)}/decline`, {
        method: 'POST',
      }).catch(() => {});
    }
  }, [incomingMeetCall]);

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

  React.useEffect(() => {
    if (!activeCallAssistant || !isCallConnected || isWaitingForAssistant) return;
    markAssistantOnline(activeCallAssistant.agentId);
  }, [activeCallAssistant, isCallConnected, isWaitingForAssistant, markAssistantOnline]);

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
      setIsEditFormReady(false);
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

  const hireTeams = React.useMemo(
    () =>
      rosterTeams.map((team) => ({
        teamId: team.teamId,
        name: team.name,
        isOrgWideSharing: team.isOrgWideSharing,
      })),
    [rosterTeams]
  );

  const handleOpenHireDialog = React.useCallback(
    (presetOwnerTeamId?: number) => {
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

      // Team-first hiring: default the owning team to the workspace the hire
      // started from, else the managed org-wide team, else the first team.
      // Skipping (choosing "Personal") yields a personally-supervised hire.
      const defaultOwnerTeamId =
        presetOwnerTeamId ??
        hireTeams.find((team) => team.isOrgWideSharing)?.teamId ??
        hireTeams[0]?.teamId ??
        null;
      formMethods.setValue('ownerTeamId', defaultOwnerTeamId);

      // Mark that we need to select a preset once they're loaded
      setNeedsPresetSelection(true);
      setUserHasChangedPreset(false);

      // Open the dialog - this triggers lazy loading of presets
      setIsHireDialogOpen(true);
    },
    [
      resetHireFormInternal,
      setPresetAgeFilter,
      setPresetNationalityFilter,
      setPresetGenderFilter,
      setPresetLanguageFilter,
      workspaceConnectAvailable,
      hireTeams,
      formMethods,
    ]
  );

  const applyRandomUnityProfile = React.useCallback(() => {
    const profile = createAvailableUnityProfile(
      assistants
        .map((a) => `${a.firstName ?? ''} ${a.surname ?? ''}`.trim().toLowerCase())
        .filter(Boolean),
      assistants.map((a) => (a.firstName ?? '').trim().toLowerCase()).filter(Boolean)
    );
    formMethods.setValue('firstName', profile.firstName, { shouldValidate: true });
    formMethods.setValue('surname', profile.surname, { shouldValidate: true });
    formMethods.setValue('jobTitle', profile.jobTitle, { shouldValidate: true });
    formMethods.setValue('about', profile.about, { shouldValidate: true });
    formMethods.setValue('isPresetPristine', false);
  }, [assistants, formMethods]);

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

  React.useEffect(() => {
    void import('./Edit/AssistantEdit');
  }, []);

  const loadAssistantForEditRef = React.useRef(loadAssistantForEdit);
  loadAssistantForEditRef.current = loadAssistantForEdit;
  const assistantToEditRef = React.useRef(assistantToEdit);
  assistantToEditRef.current = assistantToEdit;
  const assistantToEditId = assistantToEdit?.agentId ?? null;

  React.useEffect(() => {
    const assistant = assistantToEditRef.current;
    if (!assistantToEditId || !assistant) {
      setIsEditFormReady(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      loadAssistantForEditRef.current(assistant);
      setIsEditFormReady(true);
    });

    return () => cancelAnimationFrame(frame);
    // Only reload when a different assistant is opened. Re-running on callback
    // identity changes reset()s the form and snaps Default model back.
  }, [assistantToEditId]);

  const handleOpenEditDialog = React.useCallback((assistant: Assistant) => {
    setIsEditFormReady(false);
    setAssistantToEdit(assistant);
  }, []);

  const handleCloseEditDialog = React.useCallback(() => {
    setAssistantToEdit(null);
    setIsEditFormReady(false);
  }, []);

  const isEditProfileOpening = Boolean(assistantToEdit && !isEditFormReady);

  const handleOpenContactManager = React.useCallback(
    (assistant: Assistant, tab: ContactManagerInitialTab = 'email') => {
      setContactManagerInitialTab(tab);
      setContactManagerAssistant(assistant);
    },
    []
  );

  const handleOpenWorkspaceManager = React.useCallback((assistant: Assistant) => {
    setWorkspaceManagerInitialProvider(null);
    setWorkspaceManagerAssistant(assistant);
  }, []);

  /**
   * Connecting a Workspace, from wherever the user starts.
   *
   * Every surface that offers it — the onboarding checklist, the Workflows
   * shelf's `workspace` requirement — goes through here rather than calling
   * the opener bare, because opening the manager is only half the act: the
   * checklist step has to engage too, and it is the coordinator's checklist,
   * so it engages only when the coordinator is the assistant being connected.
   */
  const handleConnectWorkspace = React.useCallback(
    (assistant: Assistant) => {
      if (canonicalCoordinator && assistant.agentId === canonicalCoordinator.agentId) {
        markStepEngaged('workspace');
      }
      handleOpenWorkspaceManager(assistant);
    },
    [canonicalCoordinator, markStepEngaged, handleOpenWorkspaceManager]
  );

  const handleOpenBrainManager = React.useCallback((assistant: Assistant) => {
    setBrainManagerAssistant(assistant);
  }, []);

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
    (tab: RightPaneTab, stepId: string, integrations?: RightPaneIntegrationsState) => {
      markStepEngaged(stepId);
      setActiveBrainSectionId(null);
      setPaneState((prev) => ({
        ...prev,
        primary: tab === 'integrations' ? { tab, integrations } : { tab },
      }));
    },
    [markStepEngaged]
  );

  // Open the user's account settings. By default opens a new tab so the
  // chat session isn't disrupted; pass `sameTab` to navigate in the
  // current tab instead. Optional `tab` mirrors the /account page's
  // `?tab=` param (see SettingsView) so callers can deep-link straight
  // to the relevant section.
  const handleOpenUserSettings = React.useCallback(
    (tab?: string, sameTab = false) => {
      if (typeof window === 'undefined') return;
      requestCoordinatorOnboardingInfoClose();
      const url = tab ? `/account?tab=${encodeURIComponent(tab)}` : '/account';
      try {
        window.localStorage.setItem(
          'console:assistants:user-settings-opened-at',
          String(Date.now())
        );
      } catch {
        /* private mode / quota — refresh just won't trigger */
      }
      if (sameTab) {
        router.push(url);
      } else {
        window.open(url, '_blank', 'noopener');
      }
    },
    [requestCoordinatorOnboardingInfoClose, router]
  );

  const appendCoordinatorRequestSentAck = React.useCallback(
    (label: string) => {
      if (!canonicalCoordinator) return;
      appendRequestSentAck(setRequestAckHistories, canonicalCoordinator.agentId, label);
    },
    [canonicalCoordinator]
  );

  const resolveOnboardingStepLabel = React.useCallback(
    (stepId: string, chipId?: string): string | null => {
      const step = coordinatorOnboardingState?.onboarding?.steps.find(
        (candidate) => candidate.id === stepId
      );
      if (!step) return null;
      if (chipId) {
        const chip = [...step.chipsChat, ...step.chipsCall].find(
          (candidate) => candidate.id === chipId
        );
        return chip?.label ?? step.title;
      }
      return step.title;
    },
    [coordinatorOnboardingState?.onboarding?.steps]
  );

  const handleCoordinatorStartOnboardingStep = React.useCallback(
    (stepId: string) => {
      if (!shouldDispatchStepRequest(stepId)) {
        void refetchCoordinatorOnboardingState();
        return;
      }
      if (ONBOARDING_START_ACK_STEP_IDS.has(stepId)) {
        const label = resolveOnboardingStepLabel(stepId);
        if (label) appendCoordinatorRequestSentAck(label);
      }
      markStepEngaged(stepId);
      markStepRequested(stepId);
      void updateCoordinatorOnboardingState({ onboardingStep: stepId });
    },
    [
      appendCoordinatorRequestSentAck,
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      resolveOnboardingStepLabel,
      shouldDispatchStepRequest,
      updateCoordinatorOnboardingState,
    ]
  );

  const handleCoordinatorTriggerReferenceStep = React.useCallback(
    (stepId: string, chipId?: string) => {
      if (!canonicalCoordinator) return;
      const step = coordinatorOnboardingState?.onboarding?.steps.find(
        (candidate) => candidate.id === stepId
      );
      if (!step) return;
      const requestKey = chipId ? `${stepId}:${chipId}` : stepId;
      if (!shouldDispatchStepRequest(requestKey)) {
        void refetchCoordinatorOnboardingState();
        return;
      }
      const label = resolveOnboardingStepLabel(stepId, chipId);
      if (label) appendCoordinatorRequestSentAck(label);
      markStepEngaged(stepId);
      markStepRequested(requestKey);
      void (async () => {
        try {
          const event = await dispatchCoordinatorOnboardingStepEvent(
            canonicalCoordinator.agentId,
            step,
            chipId
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
      appendCoordinatorRequestSentAck,
      canonicalCoordinator,
      coordinatorOnboardingState?.onboarding?.steps,
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      resolveOnboardingStepLabel,
      shouldDispatchStepRequest,
      updateCoordinatorOnboardingState,
    ]
  );

  const resolveIntegrationChipFilters = React.useCallback(
    (stepId: string, chipId?: string): RightPaneIntegrationsState | undefined => {
      if (stepId !== 'apps' || !chipId) return undefined;
      const step = coordinatorOnboardingState?.onboarding?.steps.find(
        (candidate) => candidate.id === stepId
      );
      const chip = step
        ? [...step.chipsChat, ...step.chipsCall].find((item) => item.id === chipId)
        : null;
      const searchQuery = typeof chip?.searchQuery === 'string' ? chip.searchQuery : undefined;
      if (!ENABLE_INTEGRATION_LABEL_FILTER) {
        return searchQuery ? { query: searchQuery } : undefined;
      }
      const galleryCategory =
        typeof chip?.galleryCategory === 'string' ? chip.galleryCategory : undefined;
      if (galleryCategory === 'productivity') {
        return { semanticCategory: 'productivity', query: searchQuery };
      }
      if (galleryCategory === 'crm_sales') {
        return { semanticCategory: 'crm', query: searchQuery };
      }
      return searchQuery ? { query: searchQuery, semanticCategory: 'all' } : undefined;
    },
    [coordinatorOnboardingState?.onboarding?.steps]
  );

  // Dispatch the graph-owned event for a Tasks-phase beat. Clicking the row
  // (no ``chipId``) asks Twin to open a freeform conversation about that kind
  // of standing work; clicking one of its example chips (``chipId`` set) asks
  // Twin to set that specific task up. Mirrors the reference-quiz trigger path
  // but without a paired reply — beat completion is derived server-side from
  // the resulting Tasks row. The request is deduped per (step, chip) so a
  // double-click can't fire two task-creation events.
  const handleCoordinatorDispatchTaskBeat = React.useCallback(
    (stepId: string, chipId?: string) => {
      if (!canonicalCoordinator) return;
      const step = coordinatorOnboardingState?.onboarding?.steps.find(
        (candidate) => candidate.id === stepId
      );
      if (!step) return;
      if (stepId === 'apps') {
        beginAppsConnectFlow();
        handleCoordinatorOpenPaneTab(
          'integrations',
          stepId,
          resolveIntegrationChipFilters(stepId, chipId)
        );
      }
      const requestKey = chipId ? `${stepId}:${chipId}` : stepId;
      if (!shouldDispatchStepRequest(requestKey)) {
        void refetchCoordinatorOnboardingState();
        return;
      }
      const label = resolveOnboardingStepLabel(stepId, chipId);
      if (label) appendCoordinatorRequestSentAck(label);
      markStepEngaged(stepId);
      markStepRequested(requestKey);
      void (async () => {
        try {
          const event = await dispatchCoordinatorOnboardingStepEvent(
            canonicalCoordinator.agentId,
            step,
            chipId
          );
          if (!event) return;
          void refetchCoordinatorOnboardingState();
        } catch (error) {
          console.error('[Coordinator onboarding] Failed to dispatch task beat event:', error);
          toast.error('Could not start this task. Please try again.');
        }
      })();
    },
    [
      appendCoordinatorRequestSentAck,
      canonicalCoordinator,
      coordinatorOnboardingState?.onboarding?.steps,
      beginAppsConnectFlow,
      handleCoordinatorOpenPaneTab,
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      resolveIntegrationChipFilters,
      resolveOnboardingStepLabel,
      shouldDispatchStepRequest,
    ]
  );

  // Dispatch the graph-owned event for the Learning tutorial row. Row click
  // starts the guided expenses-etl demo directly — no chips. Mirrors the Tasks
  // beat path: Orchestra emits the canonical onboarding event to Unity and the
  // user stays on the current surface — no pane navigation.
  const handleCoordinatorDispatchLearningBeat = React.useCallback(
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
      const label = resolveOnboardingStepLabel(stepId);
      if (label) appendCoordinatorRequestSentAck(label);
      markStepEngaged(stepId);
      markStepRequested(stepId);
      void (async () => {
        try {
          const emitted = await dispatchCoordinatorOnboardingStepEvent(
            canonicalCoordinator.agentId,
            step
          );
          if (!emitted) return;
          void refetchCoordinatorOnboardingState();
        } catch (error) {
          console.error('[Coordinator onboarding] Failed to dispatch learning beat event:', error);
          toast.error('Could not start this learning exercise. Please try again.');
        }
      })();
    },
    [
      appendCoordinatorRequestSentAck,
      canonicalCoordinator,
      coordinatorOnboardingState?.onboarding?.steps,
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      resolveOnboardingStepLabel,
      shouldDispatchStepRequest,
    ]
  );

  // Dispatch the graph-owned event for the My Computer live demo row. Row click
  // starts the call-anchored desktop errand directly — no pane navigation.
  // Mirrors the Learning beat path: Orchestra emits the canonical onboarding
  // event to Unity and the user stays on the current surface.
  const handleCoordinatorDispatchMyComputerBeat = React.useCallback(
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
      const label = resolveOnboardingStepLabel(stepId);
      if (label) appendCoordinatorRequestSentAck(label);
      markStepEngaged(stepId);
      markStepRequested(stepId);
      void (async () => {
        try {
          const emitted = await dispatchCoordinatorOnboardingStepEvent(
            canonicalCoordinator.agentId,
            step
          );
          if (!emitted) return;
          void refetchCoordinatorOnboardingState();
        } catch (error) {
          console.error(
            '[Coordinator onboarding] Failed to dispatch My Computer beat event:',
            error
          );
          toast.error('Could not start this demo. Please try again.');
        }
      })();
    },
    [
      appendCoordinatorRequestSentAck,
      canonicalCoordinator,
      coordinatorOnboardingState?.onboarding?.steps,
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      resolveOnboardingStepLabel,
      shouldDispatchStepRequest,
    ]
  );

  // Dispatch the Their Computer fetch-and-return beat. Channel-agnostic (chat
  // or mid-call); no ring and no pane navigation — same dispatch shape as My
  // Computer, different framing on the Orchestra event.
  const handleCoordinatorDispatchYourComputerBeat = React.useCallback(
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
      const label = resolveOnboardingStepLabel(stepId);
      if (label) appendCoordinatorRequestSentAck(label);
      markStepEngaged(stepId);
      markStepRequested(stepId);
      void (async () => {
        try {
          const emitted = await dispatchCoordinatorOnboardingStepEvent(
            canonicalCoordinator.agentId,
            step
          );
          if (!emitted) return;
          void refetchCoordinatorOnboardingState();
        } catch (error) {
          console.error(
            '[Coordinator onboarding] Failed to dispatch Their Computer beat event:',
            error
          );
          toast.error('Could not start this demo. Please try again.');
        }
      })();
    },
    [
      appendCoordinatorRequestSentAck,
      canonicalCoordinator,
      coordinatorOnboardingState?.onboarding?.steps,
      markStepEngaged,
      markStepRequested,
      refetchCoordinatorOnboardingState,
      resolveOnboardingStepLabel,
      shouldDispatchStepRequest,
    ]
  );

  const handleCoordinatorOpenDesktopLinker = React.useCallback(
    (stepId: string) => {
      if (!canonicalCoordinator) return;
      markStepEngaged(stepId);
      setDesktopLinkerAssistant(canonicalCoordinator);
    },
    [canonicalCoordinator, markStepEngaged]
  );

  const handleCoordinatorAddWhatsappNumber = React.useCallback(() => {
    handleCoordinatorStartOnboardingStep('whatsapp-number');
    handleOpenUserSettings('contact-info', true);
  }, [handleCoordinatorStartOnboardingStep, handleOpenUserSettings]);

  const handleCoordinatorAddPhoneNumber = React.useCallback(() => {
    handleCoordinatorStartOnboardingStep('phone-number');
    handleOpenUserSettings('contact-info', true);
  }, [handleCoordinatorStartOnboardingStep, handleOpenUserSettings]);

  const handleCoordinatorAddDiscordId = React.useCallback(() => {
    handleCoordinatorStartOnboardingStep('discord-id');
    handleOpenUserSettings('contact-info', true);
  }, [handleCoordinatorStartOnboardingStep, handleOpenUserSettings]);

  const handleCoordinatorConnectSlack = React.useCallback(() => {
    if (!canonicalCoordinator) return;
    handleCoordinatorStartOnboardingStep('slack-connect');
    handleOpenContactManager(canonicalCoordinator, 'slack');
  }, [canonicalCoordinator, handleCoordinatorStartOnboardingStep, handleOpenContactManager]);

  const handleCoordinatorConnectMsTeams = React.useCallback(() => {
    if (!canonicalCoordinator) return;
    handleCoordinatorStartOnboardingStep('ms-teams-connect');
    handleOpenContactManager(canonicalCoordinator, 'ms_teams_bot');
  }, [canonicalCoordinator, handleCoordinatorStartOnboardingStep, handleOpenContactManager]);

  // The Unify Teams bot is reply-only: it cannot open a conversation, so the
  // ``ms-teams-reference`` step is user-initiated. This opens the Teams chat
  // with the bot (via a deep link that also adds the app for the user first
  // when a catalog id is configured) so they can send it a first message —
  // that inbound is what seeds the conversation reference and completes the
  // step. Starting the step locally lets the row settle immediately.
  const handleCoordinatorOpenMsTeamsChat = React.useCallback(() => {
    const link = buildMsTeamsChatDeepLink({
      catalogId: MS_TEAMS_APP_CATALOG_ID,
      botAppId: userMeta.msTeamsBotInitialInstall?.botAppId ?? null,
    });
    if (!link) return;
    handleCoordinatorStartOnboardingStep('ms-teams-reference');
    window.open(link, '_blank', 'noopener,noreferrer');
  }, [userMeta.msTeamsBotInitialInstall?.botAppId, handleCoordinatorStartOnboardingStep]);

  const handleCoordinatorConnectDiscord = React.useCallback(() => {
    if (!canonicalCoordinator) return;
    handleCoordinatorStartOnboardingStep('discord-connect');
    handleOpenContactManager(canonicalCoordinator, 'discord');
    // ``discord-connect`` is no longer server-derivable: adding the public
    // bot to a server is invisible to Orchestra, so opening the connect flow
    // is the explicit user action that completes the step. Persist a durable
    // manual completion (idempotent) and tick locally so the row settles
    // immediately rather than after a refetch.
    markStepCompleted('discord-connect');
    void updateCoordinatorOnboardingState({
      onboardingStepCompletion: { stepId: 'discord-connect', completed: true },
    });
  }, [
    canonicalCoordinator,
    handleCoordinatorStartOnboardingStep,
    handleOpenContactManager,
    markStepCompleted,
    updateCoordinatorOnboardingState,
  ]);

  // Whether the Coordinator still has an actionable onboarding step left.
  // Drives the "Assistant info" nudge dot and request-scoped onboarding
  // focus layout from the coordinator checklist (not the per-assistant roadmap).
  const coordinatorOnboardingOutstanding = React.useMemo(
    () =>
      isCanonicalCoordinatorOwned &&
      isCoordinatorOnboardingActive &&
      hasOutstandingCoordinatorOnboarding(coordinatorOnboardingState?.onboarding ?? null),
    [
      isCanonicalCoordinatorOwned,
      isCoordinatorOnboardingActive,
      coordinatorOnboardingState?.onboarding,
    ]
  );
  const canApplyCoordinatorOnboardingFocusLayout =
    ENABLE_COORDINATOR_ONBOARDING &&
    isCanonicalCoordinatorOwned &&
    isCoordinatorOnboardingActive &&
    coordinatorOnboardingOutstanding &&
    !showCoordinatorOnboardingIntro &&
    canonicalCoordinatorId !== null &&
    profileAssistantId === canonicalCoordinatorId &&
    (coordinatorIntroDismissed || coordinatorOnboardingState?.introWatched === true);
  const isCoordinatorOnboardingFocusLayout =
    canApplyCoordinatorOnboardingFocusLayout && coordinatorOnboardingFocusLayoutRequest > 0;

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
      onAddDiscordId: contactDiscord ? handleCoordinatorAddDiscordId : undefined,
      onConnectSlack:
        userMeta.slackOwner && assistantActions.slack ? handleCoordinatorConnectSlack : undefined,
      onConnectMsTeams:
        userMeta.msTeamsBotOwner && assistantActions.msTeamsBot
          ? handleCoordinatorConnectMsTeams
          : undefined,
      // Only wire the reply-first "send your first Teams message" row when a
      // deep link is actually buildable (a public catalog id, or the tenant
      // install's bot app id). Otherwise it degrades to a static entry.
      onOpenMsTeamsChat:
        userMeta.msTeamsBotOwner &&
        (MS_TEAMS_APP_CATALOG_ID || userMeta.msTeamsBotInitialInstall?.botAppId)
          ? handleCoordinatorOpenMsTeamsChat
          : undefined,
      onConnectDiscord: contactDiscord ? handleCoordinatorConnectDiscord : undefined,
      onConnectWorkspace: workspaceConnectAvailable
        ? () => handleConnectWorkspace(canonicalCoordinator)
        : undefined,
      onConnectApps: () => {
        beginAppsConnectFlow();
        handleCoordinatorOpenPaneTab('integrations', 'apps');
      },
      onActNow: () => handleCoordinatorOpenPaneTab('actions', 'act'),
      onCreateScheduledTask: () => handleCoordinatorDispatchTaskBeat('create-scheduled-task'),
      onCreateTriggerableTask: () => handleCoordinatorDispatchTaskBeat('create-triggerable-task'),
      onSelectTaskChip: (stepId: string, chipId: string) =>
        stepId === 'integration-read' || stepId === 'integration-action'
          ? handleCoordinatorTriggerReferenceStep(stepId, chipId)
          : handleCoordinatorDispatchTaskBeat(stepId, chipId),
      onLearnFromCorrection: () => handleCoordinatorDispatchLearningBeat('learn-from-correction'),
      onMyComputerDemo: () => handleCoordinatorDispatchMyComputerBeat('my-computer-demo'),
      onConnectYourComputer: () => handleCoordinatorOpenDesktopLinker('your-computer-link'),
      onEnableDesktopFilesys: () => handleCoordinatorOpenDesktopLinker('your-computer-filesys'),
      onYourComputerDemo: () => handleCoordinatorDispatchYourComputerBeat('your-computer-demo'),
      appendRequestSentAck: appendCoordinatorRequestSentAck,
      onSkipStep: handleCoordinatorOnboardingStepSkip,
      onUnskipStep: handleCoordinatorOnboardingStepUnskip,
      onStepComplete: isProfileCoordinator ? markStepCompleted : undefined,
      // Flavours the "Ask T-W1N to do something" suggestion chips:
      // call-friendly prompts while on a voice call, chat-friendly
      // otherwise.
      isOnCall:
        !!activeCallAssistant && activeCallAssistant.agentId === canonicalCoordinator.agentId,
      isOnboardingActive: isCoordinatorOnboardingActive,
    };
    // ``handleConnectWorkspace`` is stable (useCallback) but omitted from
    // deps — this surface rarely re-reacts to handler identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCanonicalCoordinatorOwned,
    isCoordinatorOnboardingActive,
    canonicalCoordinator,
    profileAssistantId,
    activeCallAssistant,
    assistantActions.slack,
    assistantActions.msTeamsBot,
    contactDiscord,
    contactPhone,
    contactWhatsapp,
    userMeta.slackOwner,
    userMeta.msTeamsBotOwner,
    userMeta.msTeamsBotInitialInstall?.botAppId,
    markStepEngaged,
    beginAppsConnectFlow,
    markStepCompleted,
    handleCoordinatorStartOnboardingStep,
    handleCoordinatorTriggerReferenceStep,
    handleCoordinatorAddWhatsappNumber,
    handleCoordinatorAddPhoneNumber,
    handleCoordinatorAddDiscordId,
    handleCoordinatorConnectSlack,
    handleCoordinatorConnectMsTeams,
    handleCoordinatorOpenMsTeamsChat,
    handleCoordinatorConnectDiscord,
    handleCoordinatorOpenPaneTab,
    handleCoordinatorDispatchTaskBeat,
    handleCoordinatorDispatchLearningBeat,
    handleCoordinatorDispatchMyComputerBeat,
    handleCoordinatorDispatchYourComputerBeat,
    handleCoordinatorOpenDesktopLinker,
    appendCoordinatorRequestSentAck,
    handleCoordinatorOnboardingStepSkip,
    handleCoordinatorOnboardingStepUnskip,
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
        coordinatorOnboardingState?.onboardingActive === true &&
        coordinatorOnboardingState?.introWatched === false;
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

  React.useEffect(() => {
    if (!showCoordinatorOnboardingIntro || !canonicalCoordinatorId) return;
    void wakeCoordinator(canonicalCoordinatorId);
  }, [showCoordinatorOnboardingIntro, canonicalCoordinatorId]);

  React.useEffect(() => {
    if (!canonicalCoordinatorId) return;
    if (!showCoordinatorOnboardingIntro && !awaitingCoordinatorChatIntro) return;
    markAssistantOnline(String(canonicalCoordinatorId));
  }, [
    awaitingCoordinatorChatIntro,
    canonicalCoordinatorId,
    markAssistantOnline,
    showCoordinatorOnboardingIntro,
  ]);

  // Seed durable step completion from the server-derived
  // ``completedStepIds`` on the Coordinator/State read. Orchestra
  // re-derives the set from domain data (BYOD email contact,
  // integration secrets, action history, Tasks rows) on every state
  // read, so steps completed in earlier sessions are marked done
  // before the picker renders — the layout already blocks on that
  // read via ``isCoordinatorOnboardingResolvePending``. Live
  // in-session completion still comes from the pane observers
  // (``onTasksCountChange`` / ``onHasActiveActionChange``) plus the
  // OAuth-complete refetch and SSE ``OnboardingStateUpdated`` events;
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
      !isActiveSurface ||
      !isCoordinatorOnboardingActive ||
      !hasAccessibleCoordinatorOnboardingTargets
    ) {
      return;
    }
    const handle = window.setInterval(() => {
      void refetchCoordinatorOnboardingState();
    }, COORDINATOR_ONBOARDING_ACCESSIBLE_POLL_MS);
    return () => window.clearInterval(handle);
  }, [
    isActiveSurface,
    isCoordinatorOnboardingActive,
    hasAccessibleCoordinatorOnboardingTargets,
    refetchCoordinatorOnboardingState,
  ]);
  React.useEffect(() => {
    if (!isActiveSurface || !isCanonicalCoordinatorOwned || !ENABLE_COORDINATOR_ONBOARDING) {
      return;
    }
    const handle = window.setInterval(() => {
      void refetchCoordinatorOnboardingState();
    }, COORDINATOR_ONBOARDING_IDLE_POLL_MS);
    return () => window.clearInterval(handle);
  }, [isActiveSurface, isCanonicalCoordinatorOwned, refetchCoordinatorOnboardingState]);
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
      if (assistant.agentId === profileAssistantId) {
        if (canonicalCoordinatorId) {
          handleShowProfile(canonicalCoordinatorId);
        } else {
          handleProfileClose();
        }
      }
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
  const lastSettledProfileAssistantRef = React.useRef<Assistant | null>(null);
  if (profileAssistant) {
    lastSettledProfileAssistantRef.current = profileAssistant;
  }
  const lastSettledProfileAssistant = lastSettledProfileAssistantRef.current;
  const canUseLastSettledProfileAssistant =
    !profileAssistant &&
    !!lastSettledProfileAssistant &&
    profileAssistantId === lastSettledProfileAssistant.agentId &&
    (isLoadingAssistants ||
      isRefreshingAssistants ||
      isPendingAssistantsTarget ||
      isPendingNonAssistantsTarget);
  const visibleProfileAssistant = canUseLastSettledProfileAssistant
    ? lastSettledProfileAssistant
    : profileAssistant;

  const coordinatorDisplayName = assistantDisplayName(canonicalCoordinator);
  // Name of whatever the selector currently holds, across all four entity
  // kinds, for copy that has to say what is being deselected.
  const selectedEntityDisplayName = React.useMemo(() => {
    if (selectedHuman) return selectedHuman.name || 'this teammate';
    if (selectedTeam) return selectedTeam.name || 'this team';
    if (selectedGroup) return selectedGroup.name || 'this group';
    return assistantDisplayName(visibleProfileAssistant, 'this teammate');
  }, [selectedGroup, selectedHuman, selectedTeam, visibleProfileAssistant]);

  const forceCoordinatorChatIntroTyping =
    showCoordinatorChatIntroTyping &&
    awaitingCoordinatorChatIntro &&
    canonicalCoordinatorId !== null &&
    profileAssistant?.isCoordinator === true &&
    profileAssistant.agentId === String(canonicalCoordinatorId);

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
  // teammate's assistant get the bare Profile layout instead;
  // they have no actionable steps to tick off here.
  const isAssistantOwner =
    !!visibleProfileAssistant &&
    !!currentUserId &&
    visibleProfileAssistant.userId === currentUserId;
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
    const refreshAfterAccountRoundTrip = () => {
      if (!canWriteAssistantUrl) return;
      let openedAt: number | null = null;
      let onboardingStaleAt: number | null = readCoordinatorOnboardingStaleAt();
      try {
        const raw = window.localStorage.getItem(FLAG_KEY);
        openedAt = raw ? Number(raw) : null;
      } catch {
        return;
      }
      const now = Date.now();
      const shouldRefreshFromSettings =
        openedAt !== null && !Number.isNaN(openedAt) && now - openedAt <= TTL_MS;
      const shouldRefreshFromOnboardingStale =
        onboardingStaleAt !== null && now - onboardingStaleAt <= TTL_MS;
      if (!shouldRefreshFromSettings && !shouldRefreshFromOnboardingStale) return;
      if (shouldRefreshFromSettings) {
        try {
          window.localStorage.removeItem(FLAG_KEY);
        } catch {
          /* ignore */
        }
      }
      if (shouldRefreshFromOnboardingStale) {
        clearCoordinatorOnboardingStaleFlag();
      }
      void refetchCoordinatorOnboardingState();
      router.refresh();
    };
    const onFocus = () => {
      refreshAfterAccountRoundTrip();
    };
    const onOnboardingStale = () => {
      void refetchCoordinatorOnboardingState();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener(COORDINATOR_ONBOARDING_STALE_EVENT, onOnboardingStale);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(COORDINATOR_ONBOARDING_STALE_EVENT, onOnboardingStale);
    };
  }, [canWriteAssistantUrl, refetchCoordinatorOnboardingState, router]);

  // A provider OAuth flow (workspace BYOD, integrations) runs in a separate
  // tab that bounces through ``/oauth/complete`` and broadcasts when it's
  // done. Refetch the assistant rows + spaces so any landed connection
  // (e.g. the Coordinator's new workspace email) shows up — and the
  // onboarding step crosses off — without a manual refresh.
  // The connection row can lag the callback redirect slightly, so refetch
  // a couple of times. For the workspace flow we also dismiss the connect
  // dialogs, which the user left open in the original tab.
  React.useEffect(() => {
    const cleanupTimers: Array<() => void> = [];
    const unsubscribe = subscribeOAuthComplete((detail) => {
      if (detail.kind !== 'workspace') return;
      cleanupTimers.push(
        schedulePostIntegrationConnectRefetches({
          coordinatorId: canonicalCoordinatorId,
          refreshAssistants,
          refetchCoordinatorOnboardingState,
        })
      );
      const params = new URLSearchParams(detail.query || '');
      const contactError = params.get('contact_error');
      if (contactError || params.get('success') === 'false') {
        toast.error(
          contactError === 'email_in_use'
            ? 'That mailbox is already connected to an assistant. Disconnect it there first, or connect a different account.'
            : "Couldn't finish connecting the workspace. Please try again."
        );
      } else {
        setWorkspaceManagerInitialProvider(null);
        setContactManagerAssistant(null);
        toast.success('Workspace connected. Choose which files to share below.');
      }
    });
    return () => {
      unsubscribe();
      for (const cleanup of cleanupTimers) cleanup();
    };
  }, [canonicalCoordinatorId, refreshAssistants, refetchCoordinatorOnboardingState]);

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

  React.useEffect(() => {
    if (!brainManagerAssistant) return;
    const fresh = assistants.find((a) => a.agentId === brainManagerAssistant.agentId);
    if (
      fresh &&
      (fresh.defaultModel !== brainManagerAssistant.defaultModel ||
        fresh.defaultReasoningEffort !== brainManagerAssistant.defaultReasoningEffort)
    ) {
      setBrainManagerAssistant(fresh);
    }
  }, [assistants, brainManagerAssistant]);

  const activeCallId = activeCallAssistant?.agentId ?? null;

  // --- System error listener (assistant-level, above all interaction surfaces) ---
  useAssistantSystemErrors(visibleProfileAssistant);

  const isFirstViewAfterHire = newlyHiredInfo?.assistant.agentId === profileAssistantId;

  // Rail section selection: `view` sections drive the right-pane tab, the
  // non-tab Brain sections — `brain-view` (dedicated component, e.g. Contacts /
  // Transcripts / Functions / Guidance / Knowledge) and `placeholder`
  // ("coming soon") — take over the section host via `activeBrainSectionId`.
  // `action` sections (none today; channel-identity provisioning now lives
  // behind the Contacts directory's "Add contact" affordance) open a dialog.
  const handleSelectSection = React.useCallback(
    (section: SectionDef) => {
      if (isNonAssistantSelection) {
        if (!sectionAppliesTo(section, selectedEntityKind)) return;
        setEntitySectionId(section.id);
        return;
      }
      if (section.kind === 'action') {
        if (visibleProfileAssistant) handleOpenContactManager(visibleProfileAssistant);
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
    [isNonAssistantSelection, selectedEntityKind, visibleProfileAssistant, handleOpenContactManager]
  );

  // A section that stops applying when the entity kind changes (e.g. Members
  // after switching from a team to a human) falls back to Chat.
  React.useEffect(() => {
    if (!isNonAssistantSelection) return;
    const sectionDef = SECTION_BY_ID[entitySectionId];
    if (!sectionDef || !sectionAppliesTo(sectionDef, selectedEntityKind)) {
      setEntitySectionId(DEFAULT_SECTION_ID);
    }
  }, [entitySectionId, isNonAssistantSelection, selectedEntityKind]);
  const railActiveSectionId = isNonAssistantSelection ? entitySectionId : activeSectionId;
  const railActiveSectionDef =
    SECTION_BY_ID[railActiveSectionId] ?? SECTION_BY_ID[DEFAULT_SECTION_ID];

  const openAssistantChatFromNavigation = React.useCallback(
    (assistantId: string) => {
      const targetId = activeCallAssistant?.agentId ?? assistantId;
      handleShowProfile(targetId);
      handleOpenChatSection();
      if (activeCallAssistant) {
        redock();
      }
    },
    [activeCallAssistant, handleOpenChatSection, handleShowProfile, redock]
  );

  React.useEffect(() => {
    const onOpenAssistantChat = (event: Event) => {
      const detail = (event as CustomEvent<OpenAssistantChatDetail>).detail;
      if (!detail?.assistantId) return;
      openAssistantChatFromNavigation(detail.assistantId);
    };
    window.addEventListener(OPEN_ASSISTANT_CHAT_EVENT, onOpenAssistantChat);
    return () => window.removeEventListener(OPEN_ASSISTANT_CHAT_EVENT, onOpenAssistantChat);
  }, [openAssistantChatFromNavigation]);

  const goToPlatformHome = React.useCallback(() => {
    setMobileRailOpen(false);
    setActiveBrainSectionId(null);
    setPaneState((prev) => ({
      ...prev,
      primary: { tab: 'chat' },
      secondary: null,
    }));

    if (!canonicalCoordinatorId) {
      clearPanelProfileAssistant();
      if (canWriteAssistantUrl) {
        router.replace(pathname, { scroll: false });
      } else {
        navigateToAssistants();
      }
      return;
    }

    requestAssistantInfoPanelOpen(canonicalCoordinatorId);
    setPanelProfileAssistant(canonicalCoordinatorId);
    if (!canWriteAssistantUrl) {
      navigateTo({ surface: 'assistants', profile: canonicalCoordinatorId });
      return;
    }
    router.replace(`${pathname}?profile=${encodeURIComponent(canonicalCoordinatorId)}`, {
      scroll: false,
    });
  }, [
    canonicalCoordinatorId,
    canWriteAssistantUrl,
    clearPanelProfileAssistant,
    navigateTo,
    navigateToAssistants,
    pathname,
    router,
    setPanelProfileAssistant,
  ]);

  React.useEffect(() => {
    const onPlatformHome = () => {
      goToPlatformHome();
    };
    window.addEventListener(PLATFORM_HOME_NAVIGATION_EVENT, onPlatformHome);
    return () => {
      window.removeEventListener(PLATFORM_HOME_NAVIGATION_EVENT, onPlatformHome);
    };
  }, [goToPlatformHome]);

  const coordinatorOnboardingPresenceContext = React.useMemo(
    () => ({
      canonicalCoordinatorId,
      showCoordinatorOnboardingIntro,
      awaitingCoordinatorChatIntro,
    }),
    [awaitingCoordinatorChatIntro, canonicalCoordinatorId, showCoordinatorOnboardingIntro]
  );

  const displayedAssistantStatuses = React.useMemo(
    () => buildDisplayedAssistantStatuses(assistantStatuses, coordinatorOnboardingPresenceContext),
    [assistantStatuses, coordinatorOnboardingPresenceContext]
  );

  // The full prop bag the rail forwards to the embedded `AssistantList` (the
  // unity switcher). `isFolded`/`onToggleFold` are owned by the rail, so the
  // popover list always renders expanded.
  const rosterHumans = React.useMemo(() => {
    if (!roster) return undefined;
    // The viewer appears in Settings, not the selector — you don't DM
    // yourself.
    return roster.humans.filter((human) => human.userId !== currentUserId);
  }, [currentUserId, roster]);
  const railListProps: React.ComponentProps<typeof AssistantList> = React.useMemo(
    () => ({
      assistants: sidebarAssistants,
      assistantStatuses: displayedAssistantStatuses,
      assistantError,
      isLoading: isInitialLoadingAssistants,
      error: assistantError,
      profileAssistantId,
      onShowProfile: handleAssistantListSelect,
      onToggleAssistantInfo: handleToggleAssistantInfo,
      onOpenHireDialog: handleOpenHireDialog,
      isFolded: false,
      activeCallAssistantId: activeCallId,
      canHire,
      unreadCounts: chatStreamUnreadCounts,
      currentUserId,
      workspace: coordinatorWorkspace,
      teamsById,
      humans: rosterHumans,
      selectableTeams: rosterTeams,
      selectableGroups: rosterGroups,
      selectedEntityKey: isNonAssistantSelection ? profileAssistantId : null,
      onSelectHuman: handleSelectHuman,
      onSelectTeam: handleSelectTeam,
      onSelectGroup: handleSelectGroup,
      onCreateGroup: () => setCreateGroupOpen(true),
      onCreateTeam: () => {
        router.push('/organizations?tab=teams');
      },
      entityUnreadCounts: orgChat.unread,
      orgCallActiveUserIds:
        humanCall.isConnected && humanCall.activeCall
          ? humanCall.activeCall.participants
              .filter((p) => p.status === 'joined')
              .map((p) => p.userId)
          : [],
      orgCallActiveTeamId:
        humanCall.isConnected && humanCall.activeCall?.scope === 'team'
          ? humanCall.activeCall.teamId
          : null,
      orgCallActiveGroupId:
        humanCall.isConnected && humanCall.activeCall?.scope === 'group'
          ? humanCall.activeCall.groupId
          : null,
    }),
    [
      sidebarAssistants,
      displayedAssistantStatuses,
      assistantError,
      isInitialLoadingAssistants,
      profileAssistantId,
      handleAssistantListSelect,
      handleToggleAssistantInfo,
      handleOpenHireDialog,
      activeCallId,
      canHire,
      chatStreamUnreadCounts,
      currentUserId,
      coordinatorWorkspace,
      teamsById,
      rosterHumans,
      rosterTeams,
      rosterGroups,
      isNonAssistantSelection,
      handleSelectHuman,
      handleSelectTeam,
      handleSelectGroup,
      router,
      orgChat.unread,
      humanCall.isConnected,
      humanCall.activeCall,
    ]
  );

  const rosterHumansById = React.useMemo(() => {
    const byId: Record<string, RosterHuman> = {};
    for (const human of roster?.humans ?? []) {
      byId[human.userId] = human;
    }
    return byId;
  }, [roster?.humans]);
  const assistantFacesById = React.useMemo(() => {
    const byId: Record<string, { agentId: string; name: string; image?: string | null }> = {};
    for (const assistant of sidebarAssistants) {
      byId[assistant.agentId] = {
        agentId: assistant.agentId,
        name: assistantDisplayName(assistant),
        image: assistant.signedProfilePhotoUrl || assistant.profilePhoto || null,
      };
    }
    return byId;
  }, [sidebarAssistants]);

  // Identity carrier for team-scoped section panes: prefer an assistant that
  // is actually on the team, fall back to any visible assistant (reads are
  // pinned to the explicit team root either way).
  const teamCarrierAssistant = React.useMemo(() => {
    if (!selectedTeam) return null;
    const memberIds = new Set(selectedTeam.assistantMemberIds.map(String));
    return (
      sidebarAssistants.find((candidate) => memberIds.has(String(candidate.agentId))) ??
      sidebarAssistants[0] ??
      null
    );
  }, [selectedTeam, sidebarAssistants]);

  const activeEntityFace = React.useMemo<ActiveEntityFace | null>(() => {
    if (selectedEntity?.kind === 'human') {
      if (!selectedHuman) return { kind: 'human', label: 'Team member' };
      return {
        kind: 'human',
        label: selectedHuman.name?.trim() || selectedHuman.email || 'Team member',
        sublabel: selectedHuman.roleName ?? 'Team member',
        imageUrl: selectedHuman.image ?? null,
        online: selectedHuman.online,
      };
    }
    if (selectedEntity?.kind === 'team') {
      if (!selectedTeam) return { kind: 'team', label: 'Team' };
      const humanCount = selectedTeam.memberUserIds.length;
      const aiCount = selectedTeam.assistantMemberIds.length;
      return {
        kind: 'team',
        label: selectedTeam.name,
        sublabel: `${humanCount + aiCount} members`,
        imageUrl: selectedTeam.image ?? null,
        isOrgWideSharing: selectedTeam.isOrgWideSharing,
      };
    }
    if (selectedEntity?.kind === 'group') {
      if (!selectedGroup) return { kind: 'group', label: 'Group' };
      const humanCount = selectedGroup.memberUserIds.length;
      const aiCount = selectedGroup.assistantMemberIds.length;
      const groupFaces = [
        ...selectedGroup.memberUserIds.map((userId) => {
          const human = rosterHumansById[userId];
          return {
            id: `u:${userId}`,
            name:
              human?.name?.trim() || human?.email || (userId === currentUserId ? 'You' : userId),
            image: human?.image,
          };
        }),
        ...selectedGroup.assistantMemberIds.map((assistantId) => {
          const assistant = assistantFacesById[String(assistantId)];
          return {
            id: `a:${assistantId}`,
            name: assistant?.name || `Assistant ${assistantId}`,
            image: assistant?.image,
          };
        }),
      ];
      return {
        kind: 'group',
        label: selectedGroup.name,
        sublabel: `${humanCount + aiCount} members`,
        groupFaces,
      };
    }
    return null;
  }, [
    selectedEntity,
    selectedHuman,
    selectedTeam,
    selectedGroup,
    rosterHumansById,
    assistantFacesById,
    currentUserId,
  ]);

  const profileCanWrite = visibleProfileAssistant ? canWrite(visibleProfileAssistant) : undefined;
  const isInitialAssistantIdentityLoading = !visibleProfileAssistant && isInitialLoadingAssistants;
  const profileChatStreamConnectionStatus = visibleProfileAssistant
    ? (chatStreamConnectionStatusByAssistant[visibleProfileAssistant.agentId] ?? 'connecting')
    : 'connecting';
  const profileHasIncompleteOnboarding =
    isAssistantOwner && visibleProfileAssistant
      ? visibleProfileAssistant.agentId === canonicalCoordinatorId
        ? coordinatorOnboardingOutstanding
        : !!onboardingIncompleteByAgentId[visibleProfileAssistant.agentId]
      : false;
  const profileInfoPanelFocusLayoutRequest =
    coordinatorOnboardingFocusLayoutRequest < 0 || canApplyCoordinatorOnboardingFocusLayout
      ? coordinatorOnboardingFocusLayoutRequest
      : 0;
  const [hasUnreadActionActivity, setHasUnreadActionActivity] = React.useState(false);
  React.useEffect(() => {
    if (activeSectionId === 'actions') {
      setHasUnreadActionActivity(false);
    }
  }, [activeSectionId]);
  const { hasRunningTaskRun: hasOffTabRunningTaskRun } = useRunningTaskSnapshot({
    assistant: visibleProfileAssistant,
    enabled: isActiveSurface && activeSectionId !== 'tasks' && !!visibleProfileAssistant,
  });
  const railSectionActivity = React.useMemo(
    () => ({
      chat:
        activeSectionId !== 'chat' &&
        !!profileAssistantId &&
        (chatStreamUnreadCounts[profileAssistantId] ?? 0) > 0,
      actions: activeSectionId !== 'actions' && hasUnreadActionActivity,
      tasks: activeSectionId !== 'tasks' && hasOffTabRunningTaskRun,
    }),
    [
      activeSectionId,
      chatStreamUnreadCounts,
      hasOffTabRunningTaskRun,
      hasUnreadActionActivity,
      profileAssistantId,
    ]
  );

  return (
    <CoordinatorOnboardingProvider value={coordinatorOnboardingCtxValue}>
      <AssistantSwitcherBridgeSync
        activeUnity={profileAssistant}
        activeEntityFace={activeEntityFace}
        listProps={railListProps}
        nestedOverlayOpen={isHireDialogOpen || createGroupOpen}
        activeCallAssistantId={activeCallId}
      />
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

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div className="relative flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
            {isBelowMobile ? (
              <Sheet open={mobileRailOpen} onOpenChange={setMobileRailOpen}>
                <SheetContent side="left" className="w-[min(100vw,258px)] p-0">
                  <AssistantRail
                    activeUnity={visibleProfileAssistant}
                    activeEntityFace={activeEntityFace}
                    entityKind={selectedEntityKind}
                    isInitialAssistantIdentityLoading={isInitialAssistantIdentityLoading}
                    listProps={railListProps}
                    nestedOverlayOpen={isHireDialogOpen || createGroupOpen}
                    activeSection={railActiveSectionId}
                    sectionActivity={railSectionActivity}
                    onBrandClick={requestPlatformHomeNavigation}
                    onSelectSection={(section) => {
                      handleSelectSection(section);
                      setMobileRailOpen(false);
                    }}
                    activeCallAssistantId={activeCallId}
                    collapsed={false}
                    onCollapsedChange={(next) => {
                      if (next) {
                        setMobileRailOpen(false);
                        return;
                      }
                      handleRailCollapsedChange(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
            ) : (
              <AssistantRail
                activeUnity={visibleProfileAssistant}
                activeEntityFace={activeEntityFace}
                entityKind={selectedEntityKind}
                isInitialAssistantIdentityLoading={isInitialAssistantIdentityLoading}
                listProps={railListProps}
                nestedOverlayOpen={isHireDialogOpen || createGroupOpen}
                activeSection={railActiveSectionId}
                sectionActivity={railSectionActivity}
                onBrandClick={requestPlatformHomeNavigation}
                onSelectSection={handleSelectSection}
                activeCallAssistantId={activeCallId}
                collapsed={railCollapsed}
                onCollapsedChange={handleRailCollapsedChange}
              />
            )}

            <SectionHost
              section={railActiveSectionDef}
              headerLeading={
                isBelowMobile ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="Open navigation"
                    data-testid="rail-mobile-toggle"
                    onClick={() => setMobileRailOpen(true)}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                ) : undefined
              }
              renderView={() => {
                if (isNonAssistantSelection) {
                  if (
                    selectedEntity?.kind === 'human' &&
                    selectedHuman &&
                    activeOrganizationId &&
                    profileAssistantId
                  ) {
                    return (
                      <EntityInfoPanelLayout
                        entityId={profileAssistantId}
                        isActiveSurface={isActiveSurface}
                        ariaLabel="Human profile"
                        renderPanel={({ onClose, hideHeaderActions }) => (
                          <HumanInfoSidePanelContent
                            human={selectedHuman}
                            onClose={onClose}
                            hideHeaderActions={hideHeaderActions}
                          />
                        )}
                      >
                        <HumanWorkspace
                          human={selectedHuman}
                          orgId={activeOrganizationId}
                          chat={orgChat}
                          currentUserId={currentUserId}
                          onStartCall={() => void humanCall.startCall(selectedHuman.userId)}
                          isCallButtonDisabled={dmCallGate.disabled}
                          callButtonTooltip={dmCallGate.tooltip}
                          isConnectingCall={humanCall.isConnecting}
                          isCallActive={
                            humanCall.isConnected &&
                            humanCall.activeCall?.scope === 'dm' &&
                            humanCall.activeCall.userIds.includes(selectedHuman.userId)
                          }
                        />
                      </EntityInfoPanelLayout>
                    );
                  }
                  if (
                    selectedEntity?.kind === 'team' &&
                    selectedTeam &&
                    activeOrganizationId &&
                    profileAssistantId
                  ) {
                    return (
                      <EntityInfoPanelLayout
                        entityId={profileAssistantId}
                        isActiveSurface={isActiveSurface}
                        ariaLabel="Team profile"
                        renderPanel={({ onClose, hideHeaderActions }) => (
                          <TeamInfoSidePanelContent
                            team={selectedTeam}
                            humansById={rosterHumansById}
                            assistantsById={assistantFacesById}
                            currentUserId={currentUserId}
                            onClose={onClose}
                            hideHeaderActions={hideHeaderActions}
                          />
                        )}
                      >
                        {isTeamBrainSectionId(entitySectionId) ? (
                          <TeamBrainSectionsHost
                            carrierAssistant={teamCarrierAssistant}
                            teamId={selectedTeam.teamId}
                            activeSectionId={entitySectionId}
                            isActiveSurface={isActiveSurface}
                          />
                        ) : (
                          <TeamWorkspace
                            team={selectedTeam}
                            orgId={activeOrganizationId}
                            humansById={rosterHumansById}
                            assistantsById={assistantFacesById}
                            currentUserId={currentUserId}
                            activeSectionId={entitySectionId}
                            chat={orgChat}
                            onHireForTeam={
                              canHire ? () => handleOpenHireDialog(selectedTeam.teamId) : undefined
                            }
                            onStartCall={() => void humanCall.startTeamCall(selectedTeam.teamId)}
                            onJoinCall={
                              humanCall.activeCall?.teamId === selectedTeam.teamId &&
                              !humanCall.isConnected
                                ? () => void humanCall.joinCall(humanCall.activeCall!)
                                : humanCall.incomingCall?.teamId === selectedTeam.teamId
                                  ? () => void humanCall.answerCall(humanCall.incomingCall!)
                                  : undefined
                            }
                            canJoinActiveCall={
                              (humanCall.incomingCall?.teamId === selectedTeam.teamId &&
                                !humanCall.isConnected) ||
                              (humanCall.activeCall?.teamId === selectedTeam.teamId &&
                                humanCall.activeCall.status === 'active' &&
                                !humanCall.isConnected)
                            }
                            isCallButtonDisabled={
                              resolveCallGate(
                                { kind: 'team', teamId: selectedTeam.teamId },
                                callGateInputs
                              ).disabled
                            }
                            callButtonTooltip={
                              resolveCallGate(
                                { kind: 'team', teamId: selectedTeam.teamId },
                                callGateInputs
                              ).tooltip
                            }
                            isConnectingCall={humanCall.isConnecting}
                            isCallActive={
                              humanCall.isConnected &&
                              humanCall.activeCall?.teamId === selectedTeam.teamId
                            }
                          />
                        )}
                      </EntityInfoPanelLayout>
                    );
                  }
                  if (
                    selectedEntity?.kind === 'group' &&
                    selectedGroup &&
                    activeOrganizationId &&
                    profileAssistantId
                  ) {
                    const groupAssistants = Object.values(assistantFacesById);
                    return (
                      <EntityInfoPanelLayout
                        entityId={profileAssistantId}
                        isActiveSurface={isActiveSurface}
                        ariaLabel="Group profile"
                        renderPanel={({ onClose, hideHeaderActions }) => (
                          <GroupInfoSidePanelContent
                            group={selectedGroup}
                            humansById={rosterHumansById}
                            assistantsById={assistantFacesById}
                            currentUserId={currentUserId}
                            onClose={onClose}
                            hideHeaderActions={hideHeaderActions}
                          />
                        )}
                      >
                        <GroupWorkspace
                          group={selectedGroup}
                          orgId={activeOrganizationId}
                          humansById={rosterHumansById}
                          assistantsById={assistantFacesById}
                          allHumans={roster?.humans ?? []}
                          allAssistants={groupAssistants.filter((a) => {
                            const full = sidebarAssistants.find((s) => s.agentId === a.agentId);
                            return full ? !full.isCoordinator : true;
                          })}
                          currentUserId={currentUserId}
                          chat={orgChat}
                          onStartCall={() => void humanCall.startGroupCall(selectedGroup.groupId)}
                          onJoinCall={
                            humanCall.activeCall?.groupId === selectedGroup.groupId &&
                            !humanCall.isConnected
                              ? () => void humanCall.joinCall(humanCall.activeCall!)
                              : humanCall.incomingCall?.groupId === selectedGroup.groupId
                                ? () => void humanCall.answerCall(humanCall.incomingCall!)
                                : undefined
                          }
                          canJoinActiveCall={
                            (humanCall.incomingCall?.groupId === selectedGroup.groupId &&
                              !humanCall.isConnected) ||
                            (humanCall.activeCall?.groupId === selectedGroup.groupId &&
                              humanCall.activeCall.status === 'active' &&
                              !humanCall.isConnected)
                          }
                          isCallButtonDisabled={
                            resolveCallGate(
                              { kind: 'group', groupId: selectedGroup.groupId },
                              callGateInputs
                            ).disabled
                          }
                          callButtonTooltip={
                            resolveCallGate(
                              { kind: 'group', groupId: selectedGroup.groupId },
                              callGateInputs
                            ).tooltip
                          }
                          isConnectingCall={humanCall.isConnecting}
                          isCallActive={
                            humanCall.isConnected &&
                            humanCall.activeCall?.groupId === selectedGroup.groupId
                          }
                          onRefreshRoster={() => void refreshOrgRoster()}
                          onLeftOrDeleted={() => {
                            if (canonicalCoordinatorId) {
                              handleShowProfile(canonicalCoordinatorId);
                            } else {
                              handleProfileClose();
                            }
                          }}
                        />
                      </EntityInfoPanelLayout>
                    );
                  }
                  return <AssistantSectionSkeleton sectionId="chat" />;
                }
                return showAssistantContentSkeleton ? (
                  <AssistantSectionSkeleton sectionId={activeSectionDef.id} />
                ) : (
                  <AssistantInfoPanelLayout
                    assistant={visibleProfileAssistant}
                    currentUserId={currentUserId}
                    userEmail={userMeta.email}
                    userPhoneNumber={userMeta.phoneNumber}
                    onStartCall={handleStartCall}
                    activeCallAssistantId={activeCallId}
                    isConnectingCall={isConnectingCall}
                    canWrite={profileCanWrite}
                    isSpendingBlocked={spendingGateStatus.isBlocked}
                    spendingBlockedMessage={spendingGateStatus.blockedMessage}
                    onOpenContactManager={handleOpenContactManager}
                    onEditProfile={profileCanWrite ? handleOpenEditDialog : undefined}
                    isEditProfileOpening={isEditProfileOpening}
                    onOpenWorkspaceManager={
                      profileCanWrite ? handleOpenWorkspaceManager : undefined
                    }
                    onOpenBrainManager={profileCanWrite ? handleOpenBrainManager : undefined}
                    onConnectDesktop={isAssistantOwner ? handleShowInstallInstructions : undefined}
                    onOpenComputerUseManager={
                      profileCanWrite
                        ? (assistant) => setComputerUseManagerAssistant(assistant)
                        : undefined
                    }
                    hasUserMessage={profiledHasUserMessage}
                    hasHistoricalCall={profiledHasHistoricalCall}
                    hasUserPhoneNumber={hasUserPhoneNumber}
                    latestUserMessageAt={profiledLatestUserMessageAt}
                    onOpenUserSettings={isAssistantOwner ? handleOpenUserSettings : undefined}
                    hasIncompleteOnboarding={profileHasIncompleteOnboarding}
                    isOnboardingStatusPending={isCoordinatorOnboardingStateLoading}
                    infoPanelFocusLayoutRequest={profileInfoPanelFocusLayoutRequest}
                    coordinatorOnboarding={coordinatorOnboardingPanelHandlers}
                    onOpenChatSection={handleOpenChatSection}
                    isActiveSurface={isActiveSurface}
                  >
                    {(infoPanel) => {
                      const rightPane = (
                        <RightPaneContainer
                          assistant={visibleProfileAssistant}
                          actions={assistantActions.actions || null}
                          assistantActions={assistantActions}
                          chatHistories={profileChatHistories}
                          setChatHistories={setProfileChatHistories}
                          callPillHistories={callPillHistories}
                          setCallPillHistories={setCallPillHistories}
                          requestAckHistories={requestAckHistories}
                          userEmail={userMeta.email}
                          isFirstView={isFirstViewAfterHire}
                          preHireChat={
                            isFirstViewAfterHire ? newlyHiredInfo?.preHireChat : undefined
                          }
                          onFirstViewCompleted={handleFirstViewCompleted}
                          activeCallAssistantId={activeCallId}
                          isCallConnected={isCallConnected}
                          isConnectingCall={isConnectingCall}
                          userTimezone={userMeta.timezone}
                          canWrite={profileCanWrite}
                          spendingGate={spendingGateStatus}
                          chatStreamConnectionStatus={profileChatStreamConnectionStatus}
                          reconnectChatStream={reconnectChatStream}
                          chatStreamActivitySignal={profileChatActivitySignal}
                          paneState={paneState}
                          onPaneStateChange={setPaneState}
                          workspacePaneObscured={activeBrainSectionId !== null}
                          isActiveSurface={isActiveSurface}
                          infoPanel={infoPanel}
                          coordinatorOnboarding={coordinatorOnboardingPanelHandlers}
                          onActionsUnreadActivityChange={setHasUnreadActionActivity}
                          forceCoordinatorChatIntroTyping={forceCoordinatorChatIntroTyping}
                          onOpenComputerUseManager={
                            profileCanWrite
                              ? (assistant) => setComputerUseManagerAssistant(assistant)
                              : undefined
                          }
                          onConnectWorkspace={profileCanWrite ? handleConnectWorkspace : undefined}
                          workspaceSettledSignal={workspaceSettledSignal}
                          renderDockedCall={
                            activeCallAssistant &&
                            visibleProfileAssistant &&
                            String(activeCallAssistant.agentId) ===
                              String(visibleProfileAssistant.agentId) &&
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
                                      requestAckHistories={requestAckHistories}
                                      isConnecting={isConnectingCall}
                                      userEmail={userMeta.email}
                                      userImage={userMeta.image}
                                      isWaitingForAssistant={isWaitingForAssistant}
                                      isAssistantPreparing={isAssistantPreparing}
                                      activeOpeningConfig={activeOpeningConfig}
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
                                      toggleRemoteControlInteractive={
                                        toggleRemoteControlInteractive
                                      }
                                      isDesktopEnabled={isDesktopEnabled}
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

                      const showBrainHost =
                        activeSectionDef.kind === 'brain-view' && visibleProfileAssistant != null;
                      const mountBrainHost =
                        visibleProfileAssistant != null &&
                        (showBrainHost || hasVisitedBrainSection);

                      return (
                        <div className="relative h-full min-h-0 w-full">
                          <div
                            className={cn(
                              'h-full min-h-0 w-full',
                              showBrainHost && 'pointer-events-none absolute inset-0 z-0 hidden'
                            )}
                            aria-hidden={showBrainHost ? true : undefined}
                          >
                            {rightPane}
                          </div>
                          {mountBrainHost ? (
                            <div
                              className={cn(
                                'relative z-10 h-full min-h-0 w-full',
                                !showBrainHost && 'hidden'
                              )}
                              aria-hidden={!showBrainHost}
                            >
                              <BrainSectionsHost
                                assistant={visibleProfileAssistant}
                                activeSectionId={activeBrainSectionId ?? ''}
                                onManageContacts={() =>
                                  handleOpenContactManager(visibleProfileAssistant)
                                }
                                isActiveSurface={isActiveSurface}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    }}
                  </AssistantInfoPanelLayout>
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
                onComplete={(medium) => {
                  setCoordinatorIntroDismissed(true);
                  if (medium === 'chat') {
                    setAwaitingCoordinatorChatIntro(true);
                  } else {
                    requestCoordinatorOnboardingFocusLayout();
                  }
                  requestFirstLoginCommunicationEmailOpen();
                }}
              />
            </div>
          )}
        </div>

        {/* Dialogs and Overlays */}
        <AlertDialog
          open={pendingOnboardingPanelAction !== null}
          onOpenChange={(open) => {
            if (!open) setPendingOnboardingPanelAction(null);
          }}
        >
          <AlertDialogContent data-testid="onboarding-switch-teammate-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Switch to {coordinatorDisplayName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Onboarding lives with {coordinatorDisplayName}. Opening it selects{' '}
                {coordinatorDisplayName} and deselects {selectedEntityDisplayName}. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="onboarding-switch-teammate-cancel">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmOnboardingPanelSelectionSwitch}
                data-testid="onboarding-switch-teammate-confirm"
              >
                Switch to {coordinatorDisplayName}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {incomingMeetCall && !activeCallAssistant && !humanCall.incomingCall && (
          <IncomingMeetCallCard
            assistantName={assistantDisplayName(incomingMeetCall.assistant)}
            onAnswer={handleAnswerIncomingMeet}
            onDecline={handleDeclineIncomingMeet}
          />
        )}
        {/* Incoming ring, the Meet stage, and the minimized widget are all
            rendered app-wide by CallProvider. */}
        {activeOrganizationId ? (
          <CreateGroupDialog
            open={createGroupOpen}
            onOpenChange={setCreateGroupOpen}
            orgId={activeOrganizationId}
            currentUserId={currentUserId}
            humans={roster?.humans ?? []}
            assistants={sidebarAssistants
              .filter((a) => !a.isCoordinator)
              .map((a) => ({
                agentId: a.agentId,
                name: assistantDisplayName(a),
                image: a.signedProfilePhotoUrl || a.profilePhoto || null,
              }))}
            onCreated={(group) => {
              // Refresh first so the stale-selection effect does not clear
              // `group:{id}` against a roster that still lacks the new row.
              void refreshOrgRoster().then(() => {
                handleSelectGroup(group.groupId);
              });
            }}
          />
        ) : null}
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
              hireTeams={hireTeams}
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
              onClose={handleCloseEditDialog}
              assistant={assistantToEdit}
              formMethods={formMethods}
              onSubmit={initiateUpdate}
              isSubmitting={isFormSubmitting}
              isProcessingPhoto={isDialogBusyProcessingPhoto}
              isProcessingVoice={isDialogBusyProcessingVoice}
              onAddPaymentMethod={goToBilling}
              onDeleteAssistant={onDeleteAssistantSubmit}
              canDelete={canEndContract(assistantToEdit)}
              onMultiplayerFlipped={() => {
                handleCloseEditDialog();
                refreshAssistants(false);
              }}
              takenDisplayNames={assistants
                .filter((a) => a.agentId !== assistantToEdit.agentId)
                .map((a) => `${a.firstName ?? ''} ${a.surname ?? ''}`.trim().toLowerCase())
                .filter(Boolean)}
              takenFirstNames={assistants
                .filter((a) => a.agentId !== assistantToEdit.agentId)
                .map((a) => (a.firstName ?? '').trim().toLowerCase())
                .filter(Boolean)}
            >
              {isEditFormReady ? (
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
                    handleCloseEditDialog();
                  }}
                />
              ) : (
                <div className="flex h-full min-h-[40vh] items-center justify-center">
                  <Loader2
                    className="h-6 w-6 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              )}
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
              msTeamsBotOwner={userMeta.msTeamsBotOwner ?? null}
              msTeamsBotCanManage={userMeta.msTeamsBotCanManage ?? false}
              msTeamsBotInitialInstall={userMeta.msTeamsBotInitialInstall ?? null}
              onOpenUserSettings={handleOpenUserSettings}
            />
          )}
          {computerUseManagerAssistant && (
            <AssistantComputerUseManager
              assistant={computerUseManagerAssistant}
              open={!!computerUseManagerAssistant}
              onOpenChange={(open) => {
                if (!open) setComputerUseManagerAssistant(null);
              }}
              onUpdated={() => {
                setComputerUseManagerAssistant(null);
                handleUpdateSuccess();
              }}
              onAddPaymentMethod={goToBilling}
            />
          )}
          {workspaceManagerAssistant && (
            <AssistantWorkspaceManager
              isOpen={!!workspaceManagerAssistant}
              onClose={() => {
                setWorkspaceManagerAssistant(null);
                setWorkspaceManagerInitialProvider(null);
                setWorkspaceSettledSignal((signal) => signal + 1);
              }}
              assistant={workspaceManagerAssistant}
              assistantActions={assistantActions}
              onSuccess={handleUpdateSuccess}
              canWrite={canWrite(workspaceManagerAssistant)}
              initialProvider={workspaceManagerInitialProvider}
            />
          )}
          {brainManagerAssistant && (
            <AssistantBrainManager
              isOpen={!!brainManagerAssistant}
              onClose={() => setBrainManagerAssistant(null)}
              assistant={brainManagerAssistant}
              assistantActions={assistantActions}
              onSuccess={handleUpdateSuccess}
              canWrite={canWrite(brainManagerAssistant)}
            />
          )}
        </FormProvider>

        {desktopLinkerAssistant && (
          <AssistantDesktopLinker
            isOpen={!!desktopLinkerAssistant}
            onClose={() => {
              setDesktopLinkerAssistant(null);
              // Desktop link/filesys mutations do not push
              // onboarding_render_updated today — refetch so Their Computer
              // consent rows tick without a full page reload.
              void refetchCoordinatorOnboardingState();
            }}
            assistant={desktopLinkerAssistant}
            assistantActions={assistantActions}
            onLinked={() => {
              refreshAssistants(false);
              void refetchCoordinatorOnboardingState();
            }}
            getApiKey={assistantActions.desktop.getApiKey}
          />
        )}

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
              requestAckHistories={requestAckHistories}
              isConnecting={isConnectingCall}
              userEmail={userMeta.email}
              userImage={userMeta.image}
              isWaitingForAssistant={isWaitingForAssistant}
              isAssistantPreparing={isAssistantPreparing}
              activeOpeningConfig={activeOpeningConfig}
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
              isDesktopEnabled={isDesktopEnabled}
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

        {visibleProfileAssistant && (
          <AssistantFloatingChatHost
            pathname={routePathname ?? '/assistants'}
            isBelowMobile={isBelowMobile}
            isHireDialogOpen={isHireDialogOpen}
            showCoordinatorOnboardingIntro={showCoordinatorOnboardingIntro}
            isChatVisibleInRightPane={isFullPageAssistantChatVisible}
            hasActiveCallPoppedOut={
              !!activeCallAssistant && (!isDocked || !isAssistantsRouteActive)
            }
            profileAssistant={visibleProfileAssistant}
            assistantsBootstrapped={hasSettledAssistants}
            assistant={visibleProfileAssistant}
            assistantActions={assistantActions}
            chatHistories={profileChatHistories}
            setChatHistories={setProfileChatHistories}
            callPillHistories={callPillHistories}
            setCallPillHistories={setCallPillHistories}
            requestAckHistories={requestAckHistories}
            userEmail={userMeta.email}
            userTimezone={userMeta.timezone}
            spendingGate={spendingGateStatus}
            chatStreamConnectionStatus={profileChatStreamConnectionStatus}
            reconnectChatStream={reconnectChatStream}
            chatStreamActivitySignal={profileChatActivitySignal}
            unreadCount={chatStreamUnreadCounts[visibleProfileAssistant.agentId] ?? 0}
            hasActiveCall={!!activeCallAssistant && (isConnectingCall || isCallConnected)}
            isInActiveCall={
              !!activeCallAssistant &&
              activeCallAssistant.agentId === visibleProfileAssistant.agentId &&
              (isConnectingCall || isCallConnected)
            }
            activeCallAssistantId={activeCallAssistant?.agentId ?? null}
            isCallConnected={isCallConnected}
            onExpandedChange={handleFloatingChatExpandedChange}
            redock={redock}
          />
        )}
      </div>
    </CoordinatorOnboardingProvider>
  );
}
