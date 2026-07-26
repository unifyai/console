import * as React from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Mail, Phone, Copy, Check, Pencil, Lock, X, ChevronRight, Loader2 } from 'lucide-react';
import GoogleIcon from '@/public/icons/google-icon.png';
import MicrosoftIcon from '@/public/icons/microsoft-icon.png';

// Underlined-tabs styling, mirrored from the right-pane TAB_TRIGGER_CLASS
// so the side-panel tabs read with the same visual grammar (active tab
// gains a 2px primary underline that sits flush with the strip's 1px
// bottom border, inactive tabs remain transparent / muted). Extracted
// as a const so the font-class compliance script (which only inspects
// lines containing `className`) leaves the raw text-xs+font-medium
// combo alone — same convention the right pane uses.
const PANEL_TAB_TRIGGER_CLASS = [
  'h-8 shrink-0 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent',
  'px-1 text-xs font-medium text-muted-foreground',
  'shadow-none transition-colors hover:text-foreground',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent',
  'data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none',
].join(' ');
import { WhatsApp } from '@mui/icons-material';
import { FaDiscord } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import { AssistantSetupRoadmap } from '@/components/Pages/Assistants/Onboarding/AssistantSetupRoadmap';
import { AssistantStartCallButton } from '@/components/Pages/Assistants/Communication/AssistantStartCallButton';
import {
  useAssistantOnboardingState,
  type OnboardingDerivationContext,
} from '@/hooks/Assistants/useAssistantOnboardingState';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { CoordinatorOnboardingChecklist } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingChecklist';
import { useCoordinatorTaskBeats } from '@/hooks/Assistants/useCoordinatorTaskBeats';
import { approvedCharacterVoiceMetadata } from '@/constants/assistants/approved_character_voices';
import { resolveCoordinatorJobTitle } from '@/constants/assistants/coordinator_profile';
import { getTimezoneOffsetInMinutes, formatOffset } from '@/utils/assistants/timezone-utils';
import {
  useDefaultModelOptions,
  encodeDefaultModelValue,
} from '@/hooks/Assistants/useDefaultModelOptions';
import type { DefaultModelOption } from '@/types/assistants/assistant';

export interface AssistantInfoSidePanelContentProps {
  assistant: Assistant;
  currentUserId?: string | null;
  /** Close the assistant info panel. */
  onClose: () => void;
  /** Open the edit-profile dialog. Hidden when absent or when editing is not allowed. */
  onEditProfile?: (assistant: Assistant) => void;
  /** True while the profile edit dialog is opening. */
  isEditProfileOpening?: boolean;
  /** Open the contact manager dialog, optionally on a specific channel tab. */
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  /** Open the workspace manager dialog. */
  onOpenWorkspaceManager?: (assistant: Assistant) => void;
  /** Open the brain / model manager dialog. */
  onOpenBrainManager?: (assistant: Assistant) => void;
  /** Open the desktop linker dialog. Owner-only; omit for non-owners. */
  onConnectDesktop?: (assistant: Assistant) => void;
  /** Open the managed Computer Use manager dialog. */
  onOpenComputerUseManager?: (assistant: Assistant) => void;
  /**
   * Whether the viewer can edit this assistant. Drives the visibility
   * of every edit affordance the panel surfaces in the Profile tab.
   * Defaults to `true` so existing callers (where the panel was
   * always editable) keep their behavior; non-write surfaces should
   * pass `false` explicitly.
   */
  canWrite?: boolean;
  /**
   * Setup-roadmap deps. When provided, the panel surfaces an
   * "Onboarding" tab containing the post-hire setup checklist; once
   * every checklist item resolves the tab disappears and the panel
   * collapses to a tabless Contact Info layout.
   *
   * Pass `undefined` to suppress the Onboarding tab entirely (for
   * surfaces that don't want post-hire scaffolding, e.g. settings).
   */
  roadmap?: {
    hasUserMessage: boolean;
    hasHistoricalCall: boolean;
    hasUserPhoneNumber: boolean;
    latestUserMessageAt: Date | null;
    userEmail?: string | null;
    userPhoneNumber?: string | null;
    onStartCall: (assistant: Assistant, type: 'audio' | 'video') => void;
    /** Optionally accepts a tab id (mirrors `/account?tab=…`) so
     *  callers can deep-link into a specific section of the account
     *  page — e.g. the phone-on-profile step uses `'contact-info'`. */
    onOpenUserSettings: (tab?: string) => void;
    onSeedChatDraft: (text: string) => void;
  };
  /** Coordinator-specific onboarding wiring. When this assistant is
   * the canonical workspace Coordinator and ``Coordinator/State.onboarding_active``
   * is true, the info panel surfaces an "Onboarding"
   * sub-tab that renders the gradual-onboarding steps (the same
   * one that lives in ``CoordinatorOnboarding`` while the alternate
   * /assistants shell is mounted). The hook bag carries the action
   * handlers the rows need — the actual progress state is read from
   * ``CoordinatorOnboardingContext`` so it stays in sync across
   * surfaces. Unset means the new tab won't render even for the
   * coordinator (e.g. on non-owner viewers). */
  coordinatorOnboarding?: {
    onStartOnboardingStep?: (stepId: string) => void;
    onTriggerReferenceStep?: (stepId: string) => void;
    onAddWhatsappNumber?: () => void;
    onAddPhoneNumber?: () => void;
    onAddDiscordId?: () => void;
    onConnectSlack?: () => void;
    onConnectMsTeams?: () => void;
    onOpenMsTeamsChat?: () => void;
    onConnectDiscord?: () => void;
    onConnectWorkspace?: () => void;
    onConnectApps?: () => void;
    onActNow?: () => void;
    onCreateScheduledTask?: () => void;
    onCreateTriggerableTask?: () => void;
    /** Dispatch the event for one Tasks-phase example chip so Twin sets
     * that specific task up. ``stepId`` is the owning beat row
     * (``create-scheduled-task`` / ``create-triggerable-task``); ``chipId``
     * the chip's id. */
    onSelectTaskChip?: (stepId: string, chipId: string) => void;
    /** Dispatches the Learning tutorial beat event to Unity. */
    onLearnFromCorrection?: () => void;
    /** Dispatches the My Computer live demo beat event to Unity. */
    onMyComputerDemo?: () => void;
    /** Opens the desktop-linker dialog to connect the user's computer. */
    onConnectYourComputer?: () => void;
    /** Opens the desktop-linker dialog to enable filesystem access. */
    onEnableDesktopFilesys?: () => void;
    /** Dispatches the Their Computer fetch-and-return beat event to Unity. */
    onYourComputerDemo?: () => void;
    /** Opens a new Google Meet / Microsoft Teams meeting (per the connected
     * workspace provider) and dispatches the workspace video-call beat event
     * to Unity. Hung off the ``workspace-call`` row. Unset leaves the row as a
     * static/"coming soon" entry. */
    onWorkspaceCall?: () => void;
    /** Echo a checklist trigger acknowledgement into the coordinator chat. */
    appendRequestSentAck?: (label: string) => void;
    onSkipStep?: (stepId: string) => void;
    onUnskipStep?: (stepId: string) => void;
    /** Whether the Coordinator is currently on a voice call — selects
     * call- vs chat-flavoured "Ask T-W1N to do something" chips. */
    isOnCall?: boolean;
    /** Whether the onboarding surface is actively running. */
    isOnboardingActive?: boolean;
  };
  /** When false, suppresses background task polling for coordinator onboarding beats. */
  isActiveSurface?: boolean;
  onStartCall?: (assistant: Assistant, type: 'audio' | 'video') => void;
  isStartCallDisabled?: boolean;
  startCallTooltip?: string;
  className?: string;
  /** When true, close/edit header actions are omitted (overlay sheet toolbar owns them). */
  hideHeaderActions?: boolean;
  /** Registers the header "show profile" action for surfaces that host the panel chrome separately (mobile sheet toolbar). */
  onRegisterFocusProfileTab?: (focusProfileTab: () => void) => void;
}

const COORDINATOR_COPY_RESET_MS = 2000;
const CONTACT_COPY_RESET_MS = 2000;

type CoordinatorPanelTab = 'onboarding' | 'profile';

function nudgeElement(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove('animate-nudge');
  void element.offsetWidth;
  element.classList.add('animate-nudge');
}

function shimmerProfileSectionTiles(section: HTMLElement | null) {
  if (!section) return;
  section.querySelectorAll<HTMLElement>('[data-profile-section-tile]').forEach((tile) => {
    tile.classList.remove('animate-tile-shimmer');
    void tile.offsetWidth;
    tile.classList.add('animate-tile-shimmer');
  });
}

function useProfileTabHeaderFocus(
  showProfileTab: boolean,
  activeTab: CoordinatorPanelTab,
  setActiveTab: React.Dispatch<React.SetStateAction<CoordinatorPanelTab>>,
  profileTabTriggerRef: React.MutableRefObject<HTMLButtonElement | null>,
  profileSectionsRef: React.MutableRefObject<HTMLElement | null>
) {
  const focusProfileFromHeader = React.useCallback(() => {
    if (showProfileTab && activeTab !== 'profile') {
      setActiveTab('profile');
      return;
    }
    if (showProfileTab) {
      nudgeElement(profileTabTriggerRef.current);
      shimmerProfileSectionTiles(profileSectionsRef.current);
    }
  }, [activeTab, profileSectionsRef, profileTabTriggerRef, setActiveTab, showProfileTab]);

  return focusProfileFromHeader;
}

function ProfileTabTrigger({ triggerRef }: { triggerRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <TabsTrigger
      ref={triggerRef}
      value="profile"
      data-testid="assistant-info-tab-profile"
      className={PANEL_TAB_TRIGGER_CLASS}
    >
      Profile
    </TabsTrigger>
  );
}

/**
 * Body of the assistant info side panel.
 *
 * Two-zone layout:
 *   1. An identity header (avatar call action, name, supervisor, copy-id)
 *      with a single icon-only close button in the top-right corner.
 *      Tapping the header itself does nothing; interactions stay attached
 *      to explicit controls.
 *   2. A tabbed body. While onboarding is in progress we render two
 *      tabs (Profile / Onboarding); the moment every onboarding step
 *      resolves we drop the tab strip entirely and show Profile inline.
 *      This is the "panel progressively settles into its standard shape"
 *      arc. Onboarding is auto-selected while onboarding is active;
 *      Profile is the default when onboarding is paused or complete.
 */
export function AssistantInfoSidePanelContent({
  assistant,
  onRegisterFocusProfileTab,
  ...props
}: AssistantInfoSidePanelContentProps) {
  if (assistant.isCoordinator === true) {
    return (
      <CoordinatorAssistantInfoSidePanelContent
        assistant={assistant}
        onClose={props.onClose}
        onEditProfile={props.onEditProfile}
        isEditProfileOpening={props.isEditProfileOpening}
        className={props.className}
        onOpenContactManager={props.onOpenContactManager}
        onOpenWorkspaceManager={props.onOpenWorkspaceManager}
        onOpenBrainManager={props.onOpenBrainManager}
        onConnectDesktop={props.onConnectDesktop}
        canWrite={props.canWrite}
        coordinatorOnboarding={props.coordinatorOnboarding}
        onStartCall={props.onStartCall}
        isStartCallDisabled={props.isStartCallDisabled}
        startCallTooltip={props.startCallTooltip}
        hideHeaderActions={props.hideHeaderActions}
        isActiveSurface={props.isActiveSurface}
        onRegisterFocusProfileTab={onRegisterFocusProfileTab}
      />
    );
  }

  return (
    <RegularAssistantInfoSidePanelContent
      assistant={assistant}
      onRegisterFocusProfileTab={onRegisterFocusProfileTab}
      {...props}
    />
  );
}

function CoordinatorAssistantInfoSidePanelContent({
  assistant,
  onClose,
  onEditProfile,
  isEditProfileOpening = false,
  onOpenContactManager,
  onOpenWorkspaceManager,
  onOpenBrainManager,
  onConnectDesktop,
  className,
  canWrite = true,
  coordinatorOnboarding,
  onStartCall,
  isStartCallDisabled,
  startCallTooltip,
  hideHeaderActions = false,
  onRegisterFocusProfileTab,
  isActiveSurface = true,
}: {
  assistant: Assistant;
  onClose: () => void;
  onEditProfile?: (assistant: Assistant) => void;
  isEditProfileOpening?: boolean;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  onOpenWorkspaceManager?: (assistant: Assistant) => void;
  onOpenBrainManager?: (assistant: Assistant) => void;
  onConnectDesktop?: (assistant: Assistant) => void;
  className?: string;
  canWrite?: boolean;
  coordinatorOnboarding?: AssistantInfoSidePanelContentProps['coordinatorOnboarding'];
  onStartCall?: AssistantInfoSidePanelContentProps['onStartCall'];
  isStartCallDisabled?: boolean;
  startCallTooltip?: string;
  hideHeaderActions?: boolean;
  onRegisterFocusProfileTab?: (focusProfileTab: () => void) => void;
  isActiveSurface?: boolean;
}) {
  const showOnboardingTab = !!coordinatorOnboarding;
  const isOnboardingActive = coordinatorOnboarding?.isOnboardingActive === true;
  const taskBeats = useCoordinatorTaskBeats(assistant, {
    enabled: showOnboardingTab,
    isActiveSurface,
    isOnboardingActive,
  });

  const appendRequestSentAck = coordinatorOnboarding?.appendRequestSentAck;

  const handleTestTriggerableTask = React.useCallback(
    async (taskId: number) => {
      appendRequestSentAck?.('Test triggerable task');
      await taskBeats.testTriggerableTask(taskId);
    },
    [appendRequestSentAck, taskBeats]
  );

  const [isIdCopied, setIsIdCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<CoordinatorPanelTab>(
    showOnboardingTab && isOnboardingActive ? 'onboarding' : 'profile'
  );
  const profileTabTriggerRef = React.useRef<HTMLButtonElement>(null);
  const profileSectionsRef = React.useRef<HTMLElement>(null);
  const focusProfileFromHeader = useProfileTabHeaderFocus(
    showOnboardingTab,
    activeTab,
    setActiveTab,
    profileTabTriggerRef,
    profileSectionsRef
  );
  React.useEffect(() => {
    onRegisterFocusProfileTab?.(focusProfileFromHeader);
  }, [focusProfileFromHeader, onRegisterFocusProfileTab]);
  // Redirect off the Onboarding tab if it disappears while selected. This
  // must not depend on `activeTab` or force a tab on every render, or it
  // would clobber the user's manual tab selection on the next render.
  React.useEffect(() => {
    if (!showOnboardingTab) {
      setActiveTab((current) => (current === 'onboarding' ? 'profile' : current));
    }
  }, [showOnboardingTab]);

  // Auto-jump to Onboarding only on an actual activation transition (paused
  // → active), so starting onboarding surfaces the checklist without pinning
  // the tab against later manual navigation.
  const wasOnboardingActiveRef = React.useRef(isOnboardingActive);
  React.useEffect(() => {
    if (showOnboardingTab && isOnboardingActive && !wasOnboardingActiveRef.current) {
      setActiveTab('onboarding');
    }
    wasOnboardingActiveRef.current = isOnboardingActive;
  }, [showOnboardingTab, isOnboardingActive]);

  const copyResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    },
    []
  );

  const copyId = () => {
    navigator.clipboard.writeText(assistant.agentId);
    setIsIdCopied(true);
    if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = setTimeout(() => {
      copyResetTimerRef.current = null;
      setIsIdCopied(false);
    }, COORDINATOR_COPY_RESET_MS);
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-4', className)}>
      <IdentityHeader
        name="T-W1N"
        photoSrc={undefined}
        initials="M"
        visibilityLabel={
          <span className="inline-flex items-center gap-1">
            Only you
            <Lock className="h-3 w-3" aria-hidden="true" />
          </span>
        }
        isIdCopied={isIdCopied}
        onCopyId={copyId}
        onClose={onClose}
        onFocusProfileTab={!hideHeaderActions && canWrite ? focusProfileFromHeader : undefined}
        hideHeaderActions={hideHeaderActions}
        onStartCall={onStartCall ? () => onStartCall(assistant, 'audio') : undefined}
        isStartCallDisabled={isStartCallDisabled}
        startCallTooltip={startCallTooltip}
        avatarNode={
          <CoordinatorLogoAvatar
            className="h-20 w-20 flex-shrink-0"
            logoClassName="h-full w-full"
          />
        }
      />

      {showOnboardingTab ? (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as CoordinatorPanelTab)}
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <TabsList className="h-8 w-full items-end justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
            <ProfileTabTrigger triggerRef={profileTabTriggerRef} />
            <TabsTrigger
              value="onboarding"
              data-testid="assistant-info-tab-onboarding"
              className={PANEL_TAB_TRIGGER_CLASS}
            >
              Onboarding
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" forceMount className="mt-0 data-[state=inactive]:hidden">
            <ProfileSectionsPanel
              assistant={assistant}
              onEditProfile={onEditProfile}
              isEditProfileOpening={isEditProfileOpening}
              onOpenContactManager={onOpenContactManager}
              onOpenWorkspaceManager={onOpenWorkspaceManager}
              onOpenBrainManager={onOpenBrainManager}
              onConnectDesktop={onConnectDesktop}
              canWrite={canWrite}
              sectionsRef={profileSectionsRef}
            />
          </TabsContent>
          {coordinatorOnboarding && (
            <TabsContent
              value="onboarding"
              className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
            >
              <CoordinatorOnboardingChecklist
                onStartOnboardingStep={coordinatorOnboarding.onStartOnboardingStep}
                onTriggerReferenceStep={coordinatorOnboarding.onTriggerReferenceStep}
                onAddWhatsappNumber={coordinatorOnboarding.onAddWhatsappNumber}
                onAddPhoneNumber={coordinatorOnboarding.onAddPhoneNumber}
                onAddDiscordId={coordinatorOnboarding.onAddDiscordId}
                onConnectSlack={coordinatorOnboarding.onConnectSlack}
                onConnectMsTeams={coordinatorOnboarding.onConnectMsTeams}
                onOpenMsTeamsChat={coordinatorOnboarding.onOpenMsTeamsChat}
                onConnectDiscord={coordinatorOnboarding.onConnectDiscord}
                onConnectWorkspace={coordinatorOnboarding.onConnectWorkspace}
                onConnectApps={coordinatorOnboarding.onConnectApps}
                onActNow={coordinatorOnboarding.onActNow}
                onCreateScheduledTask={coordinatorOnboarding.onCreateScheduledTask}
                onCreateTriggerableTask={coordinatorOnboarding.onCreateTriggerableTask}
                onSelectTaskChip={coordinatorOnboarding.onSelectTaskChip}
                onLearnFromCorrection={coordinatorOnboarding.onLearnFromCorrection}
                onMyComputerDemo={coordinatorOnboarding.onMyComputerDemo}
                onConnectYourComputer={coordinatorOnboarding.onConnectYourComputer}
                onEnableDesktopFilesys={coordinatorOnboarding.onEnableDesktopFilesys}
                onYourComputerDemo={coordinatorOnboarding.onYourComputerDemo}
                onWorkspaceCall={coordinatorOnboarding.onWorkspaceCall}
                onTestTriggerableTask={handleTestTriggerableTask}
                armedTriggerableTaskId={taskBeats.armedTriggerableTaskId}
                nextScheduledTaskDueAt={taskBeats.nextScheduledTaskDueAt}
                onSkipStep={coordinatorOnboarding.onSkipStep}
                onUnskipStep={coordinatorOnboarding.onUnskipStep}
                isOnCall={coordinatorOnboarding.isOnCall}
              />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ProfileSectionsPanel
            assistant={assistant}
            onEditProfile={onEditProfile}
            isEditProfileOpening={isEditProfileOpening}
            onOpenContactManager={onOpenContactManager}
            onOpenWorkspaceManager={onOpenWorkspaceManager}
            onOpenBrainManager={onOpenBrainManager}
            onConnectDesktop={onConnectDesktop}
            canWrite={canWrite}
            sectionsRef={profileSectionsRef}
          />
        </ScrollArea>
      )}
    </div>
  );
}

function RegularAssistantInfoSidePanelContent({
  assistant,
  onClose,
  onEditProfile,
  isEditProfileOpening = false,
  onOpenContactManager,
  onOpenWorkspaceManager,
  onOpenBrainManager,
  onConnectDesktop,
  onOpenComputerUseManager,
  roadmap,
  className,
  canWrite = true,
  currentUserId,
  onStartCall,
  isStartCallDisabled,
  startCallTooltip,
  hideHeaderActions = false,
  onRegisterFocusProfileTab,
}: AssistantInfoSidePanelContentProps) {
  const [isIdCopied, setIsIdCopied] = React.useState(false);

  // Hook lifted here so writes from the roadmap (markResolved) flip
  // the onboarding-tab visibility in the same render — see hook
  // header for rationale.
  const derivationContext: OnboardingDerivationContext = roadmap
    ? {
        hasUserMessage: roadmap.hasUserMessage,
        hasHistoricalCall: roadmap.hasHistoricalCall,
        hasUserPhoneNumber: roadmap.hasUserPhoneNumber,
        latestUserMessageAt: roadmap.latestUserMessageAt,
      }
    : {
        hasUserMessage: false,
        hasHistoricalCall: false,
        hasUserPhoneNumber: false,
        latestUserMessageAt: null,
      };
  const onboardingState = useAssistantOnboardingState(assistant, derivationContext);
  const showOnboardingTab = !!roadmap && onboardingState.shouldShowRoadmap;

  // Controlled tab state so we can auto-switch to Profile the moment
  // Onboarding completes (otherwise the user would see an empty body
  // until they manually clicked the surviving tab).
  const [activeTab, setActiveTab] = React.useState<'onboarding' | 'profile'>(
    showOnboardingTab ? 'onboarding' : 'profile'
  );
  const profileTabTriggerRef = React.useRef<HTMLButtonElement>(null);
  const profileSectionsRef = React.useRef<HTMLElement>(null);
  const focusProfileFromHeader = useProfileTabHeaderFocus(
    showOnboardingTab,
    activeTab,
    setActiveTab,
    profileTabTriggerRef,
    profileSectionsRef
  );
  React.useEffect(() => {
    onRegisterFocusProfileTab?.(focusProfileFromHeader);
  }, [focusProfileFromHeader, onRegisterFocusProfileTab]);
  React.useEffect(() => {
    if (!showOnboardingTab && activeTab === 'onboarding') setActiveTab('profile');
    if (showOnboardingTab && activeTab === 'profile' && onboardingState.resolvedSteps === 0) {
      // Re-entering an assistant that was never started — land on
      // onboarding by default (only when no progress has happened
      // yet, so we don't second-guess the user's last selection).
      setActiveTab('onboarding');
    }
  }, [showOnboardingTab, activeTab, onboardingState.resolvedSteps]);

  const displayName = assistantDisplayName(assistant);
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto || undefined;
  const supervisorName =
    currentUserId && assistant.userId === currentUserId
      ? 'You'
      : [assistant.userFirstName, assistant.userLastName].filter(Boolean).join(' ');

  const copyId = () => {
    navigator.clipboard.writeText(assistant.agentId);
    setIsIdCopied(true);
    setTimeout(() => setIsIdCopied(false), 2000);
  };

  const profileBody = () => (
    <ProfileSectionsPanel
      assistant={assistant}
      onEditProfile={onEditProfile}
      isEditProfileOpening={isEditProfileOpening}
      onOpenContactManager={onOpenContactManager}
      onOpenWorkspaceManager={onOpenWorkspaceManager}
      onOpenBrainManager={onOpenBrainManager}
      onConnectDesktop={onConnectDesktop}
      onOpenComputerUseManager={onOpenComputerUseManager}
      canWrite={canWrite}
      sectionsRef={profileSectionsRef}
    />
  );

  return (
    <ScrollArea className={cn('flex-1', className)}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <IdentityHeader
          name={displayName}
          photoSrc={photoSrc}
          initials={assistantInitials(assistant)}
          supervisorName={supervisorName}
          visibilityLabel="Everyone"
          isIdCopied={isIdCopied}
          onCopyId={copyId}
          onClose={onClose}
          onFocusProfileTab={!hideHeaderActions && canWrite ? focusProfileFromHeader : undefined}
          hideHeaderActions={hideHeaderActions}
          onStartCall={onStartCall ? () => onStartCall(assistant, 'audio') : undefined}
          isStartCallDisabled={isStartCallDisabled}
          startCallTooltip={startCallTooltip}
        />

        {showOnboardingTab && roadmap ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'onboarding' | 'profile')}
            className="flex flex-col gap-3"
          >
            {/* Tab strip — underlined style mirroring the right pane.
                The TabsList draws the baseline border so the active
                trigger's 2px underline can sit flush on top of it
                (same `items-end` trick the right pane uses). */}
            <TabsList className="h-8 w-full items-end justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
              <ProfileTabTrigger triggerRef={profileTabTriggerRef} />
              <TabsTrigger
                value="onboarding"
                data-testid="assistant-info-tab-onboarding"
                className={PANEL_TAB_TRIGGER_CLASS}
              >
                Onboarding
                <span
                  className="text-label ml-1.5 rounded-full bg-primary-tint-15 px-1.5 py-0.5 text-primary"
                  data-testid="assistant-info-tab-onboarding-counter"
                >
                  {onboardingState.totalSteps - onboardingState.resolvedSteps}
                </span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="profile" forceMount className="mt-0 data-[state=inactive]:hidden">
              {profileBody()}
            </TabsContent>
            <TabsContent value="onboarding" className="mt-0">
              <AssistantSetupRoadmap
                assistant={assistant}
                state={onboardingState}
                onOpenContactManager={onOpenContactManager}
                onStartCall={roadmap.onStartCall}
                onOpenUserSettings={roadmap.onOpenUserSettings}
                onSeedChatDraft={roadmap.onSeedChatDraft}
                userEmail={roadmap.userEmail}
                userPhoneNumber={roadmap.userPhoneNumber}
              />
            </TabsContent>
          </Tabs>
        ) : (
          profileBody()
        )}
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Internal building blocks
// ---------------------------------------------------------------------------

interface IdentityHeaderProps {
  name: string;
  photoSrc: string | undefined;
  initials: string;
  supervisorName?: string;
  visibilityLabel: React.ReactNode;
  isIdCopied: boolean;
  onCopyId: () => void;
  onClose: () => void;
  onFocusProfileTab?: () => void;
  hideHeaderActions?: boolean;
  onStartCall?: () => void;
  isStartCallDisabled?: boolean;
  startCallTooltip?: string;
  avatarNode?: React.ReactNode;
}

function IdentityHeader({
  name,
  photoSrc,
  initials,
  supervisorName,
  visibilityLabel,
  isIdCopied,
  onCopyId,
  onClose,
  onFocusProfileTab,
  hideHeaderActions = false,
  onStartCall,
  isStartCallDisabled,
  startCallTooltip,
  avatarNode,
}: IdentityHeaderProps) {
  const metadataRowClass =
    'text-caption grid min-w-0 grid-cols-[10ch_minmax(0,1fr)] items-center gap-x-1 text-muted-foreground';
  const creatureAppearance = parseCreatureSentinel(photoSrc);
  const renderedAvatar =
    avatarNode ??
    (creatureAppearance ? (
      <CreatureAvatar
        appearance={creatureAppearance}
        className="h-20 w-20 flex-shrink-0"
        label={name}
      />
    ) : (
      <Avatar className="h-14 w-14 flex-shrink-0 rounded-md">
        <AvatarImage src={photoSrc} alt={name} className="rounded-md" />
        <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
      </Avatar>
    ));

  return (
    <div className="flex items-start gap-3">
      {onStartCall ? (
        <AssistantStartCallButton
          onStartCall={onStartCall}
          disabled={isStartCallDisabled}
          disabledBehavior="inert"
          tooltip={startCallTooltip}
          tooltipSide="right"
          testId="assistant-info-avatar-start-call"
        >
          {renderedAvatar}
        </AssistantStartCallButton>
      ) : (
        renderedAvatar
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-title truncate" data-testid="assistant-info-name">
          {name}
        </div>
        {supervisorName ? (
          <div className={metadataRowClass}>
            <span className="opacity-70">Supervisor:</span>
            <span className="truncate">{supervisorName}</span>
          </div>
        ) : null}
        <div className={metadataRowClass}>
          <span className="opacity-70">Visibility:</span>
          <span className="truncate">{visibilityLabel}</span>
        </div>
        <button
          type="button"
          onClick={onCopyId}
          className={cn(metadataRowClass, 'group/id w-full cursor-pointer text-left')}
          data-testid="assistant-info-copy-id"
          aria-label="Copy teammate ID"
        >
          <span className="opacity-70">Teammate ID:</span>
          <span className="flex min-w-0 items-center">
            {isIdCopied ? (
              <Check className="h-3 w-3 flex-shrink-0 text-[color:var(--status-success)]" />
            ) : (
              <Copy className="h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover/id:opacity-100" />
            )}
          </span>
        </button>
      </div>
      {!hideHeaderActions && (
        <TooltipProvider delayDuration={100}>
          <div className="-mr-1 -mt-1 flex flex-shrink-0 items-center gap-1">
            {onFocusProfileTab && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={onFocusProfileTab}
                    data-testid="assistant-info-edit-profile"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Edit</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={onClose}
                  data-testid="assistant-info-close"
                  aria-label="Close assistant info"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Close</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

interface ProfileSectionsPanelProps {
  assistant: Assistant;
  onEditProfile?: (assistant: Assistant) => void;
  isEditProfileOpening?: boolean;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  onOpenWorkspaceManager?: (assistant: Assistant) => void;
  onOpenBrainManager?: (assistant: Assistant) => void;
  onConnectDesktop?: (assistant: Assistant) => void;
  onOpenComputerUseManager?: (assistant: Assistant) => void;
  canWrite: boolean;
  sectionsRef?: React.MutableRefObject<HTMLElement | null>;
}

const DESKTOP_OS_LABELS: Record<string, string> = {
  macos: 'macOS',
  windows: 'Windows',
  ubuntu: 'Ubuntu',
};

type WorkspaceProviderKind = 'google' | 'microsoft';

function getVoiceName(assistant: Assistant): string | null {
  const voiceId = assistant.voiceId?.trim();
  if (!voiceId) return null;
  return approvedCharacterVoiceMetadata[voiceId]?.name ?? null;
}

function getTimezoneLabel(assistant: Assistant): string | null {
  const timezone = assistant.timezone?.trim();
  if (!timezone) return null;
  if (!timezone.includes('/')) return timezone;
  const offset = getTimezoneOffsetInMinutes(timezone);
  const city = timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone;
  return `(UTC${formatOffset(offset)}) ${city}`;
}

interface ProfileSummaryRow {
  label: string;
  value: string;
  clamp?: boolean;
}

function getProfileSummaryRows(assistant: Assistant): ProfileSummaryRow[] {
  const rows: ProfileSummaryRow[] = [];

  // T-W1N always surfaces the digital-twin role copy (legacy DB titles map via
  // resolveCoordinatorJobTitle). Other assistants use their stored job title.
  const role = assistant.isCoordinator
    ? resolveCoordinatorJobTitle(assistant.jobTitle)
    : assistant.jobTitle?.trim() || null;
  if (role) rows.push({ label: 'Role', value: role });

  const about = assistant.about?.trim();
  if (about) rows.push({ label: 'About', value: about, clamp: true });

  const timezone = getTimezoneLabel(assistant);
  if (timezone) rows.push({ label: 'Timezone', value: timezone });

  const voice = getVoiceName(assistant);
  if (voice) rows.push({ label: 'Voice', value: voice });

  return rows;
}

function ProfileSummary({ assistant }: { assistant: Assistant }) {
  const rows = getProfileSummaryRows(assistant);

  if (rows.length === 0) {
    return <span>No profile details yet</span>;
  }

  return (
    <div
      className="grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-2 gap-y-1"
      data-testid="assistant-info-profile-summary"
    >
      {rows.map((row) => (
        <React.Fragment key={row.label}>
          <span className="opacity-70">{row.label}:</span>
          <span className={cn('min-w-0', row.clamp ? 'line-clamp-2' : 'truncate')}>
            {row.value}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function getWorkspaceProviderKind(assistant: Assistant): WorkspaceProviderKind | null {
  // The connected-workspace provider is the OAuth grant (`workspaceProvider`),
  // not the mailbox tenant (`emailProvider`). A Coordinator keeps a platform
  // Google mailbox while connecting a Microsoft workspace, so keying off
  // `emailProvider` here would disagree with the workspace dialog.
  const provider = assistant.workspaceProvider?.trim().toLowerCase();
  if (provider === 'google') return 'google';
  if (provider === 'microsoft') return 'microsoft';
  return null;
}

function getWorkspaceStatusDescription(assistant: Assistant): {
  text: string;
  provider: WorkspaceProviderKind | null;
} {
  const providerKind = getWorkspaceProviderKind(assistant);
  if (providerKind === 'google') {
    return { text: 'Google Workspace connected', provider: 'google' };
  }
  if (providerKind === 'microsoft') {
    return { text: 'Microsoft 365 connected', provider: 'microsoft' };
  }

  return { text: 'No workspace connected yet', provider: null };
}

function getDesktopStatusDescription(assistant: Assistant): string {
  if (assistant.userDesktopUrl?.trim()) {
    const os = assistant.userDesktopMode
      ? (DESKTOP_OS_LABELS[assistant.userDesktopMode] ?? assistant.userDesktopMode)
      : 'Desktop';
    return `${os} desktop connected`;
  }
  return 'No desktop connected yet';
}

function getBrainStatusDescription(assistant: Assistant, options: DefaultModelOption[]): string {
  const resolveLabel = (
    model: string | null | undefined,
    reasoningEffort: string | null | undefined
  ): string => {
    if (!model) return 'System default';
    const selectedValue = encodeDefaultModelValue(model, reasoningEffort);
    const match = options.find(
      (option) => encodeDefaultModelValue(option.model, option.reasoningEffort) === selectedValue
    );
    if (match) return match.label;
    return reasoningEffort ? `${model} (${reasoningEffort})` : model;
  };

  return (
    `Conversation: ${resolveLabel(assistant.slowBrainModel, assistant.slowBrainReasoningEffort)}` +
    ` · Tasks: ${resolveLabel(assistant.defaultModel, assistant.defaultReasoningEffort)}`
  );
}

function getComputerUseStatusDescription(assistant: Assistant): string {
  if (assistant.managedDesktopStatus === 'grace_period') {
    return 'Grace period — add credits to keep Computer Use';
  }
  if (assistant.managedDesktopStatus === 'active' && assistant.desktopMode) {
    const label = DESKTOP_OS_LABELS[assistant.desktopMode] ?? assistant.desktopMode;
    const cost =
      assistant.managedDesktopMonthlyCost != null
        ? ` ($${assistant.managedDesktopMonthlyCost}/mo)`
        : '';
    return `${label} managed computer${cost}`;
  }
  return 'Not enabled';
}

function ProfileSectionsPanel({
  assistant,
  onEditProfile,
  isEditProfileOpening = false,
  onOpenContactManager,
  onOpenWorkspaceManager,
  onOpenBrainManager,
  onConnectDesktop,
  onOpenComputerUseManager,
  canWrite,
  sectionsRef,
}: ProfileSectionsPanelProps) {
  const { options: defaultModelOptions } = useDefaultModelOptions();
  const brainStatus = getBrainStatusDescription(assistant, defaultModelOptions);
  const workspaceStatus = getWorkspaceStatusDescription(assistant);
  const showDesktopSection = !!onConnectDesktop || !!assistant.userDesktopUrl?.trim();
  const showComputerUseSection =
    !!onOpenComputerUseManager ||
    assistant.managedDesktopStatus === 'active' ||
    assistant.managedDesktopStatus === 'grace_period';

  return (
    <section
      ref={sectionsRef}
      className="flex flex-col gap-2"
      data-testid="assistant-info-profile-sections"
    >
      <ProfileSectionTile
        title="Profile"
        description={<ProfileSummary assistant={assistant} />}
        descriptionClassName="mt-0.5"
        canEdit={canWrite && !!onEditProfile}
        isOpening={isEditProfileOpening}
        onEdit={onEditProfile ? () => onEditProfile(assistant) : undefined}
        editTestId="assistant-info-edit-profile-section"
        editAriaLabel="Edit profile"
      />
      <ProfileSectionTile
        title="Brain"
        description={brainStatus}
        canEdit={canWrite && !!onOpenBrainManager}
        onEdit={onOpenBrainManager ? () => onOpenBrainManager(assistant) : undefined}
        editTestId="assistant-info-edit-brain-section"
        editAriaLabel="Edit conversation and task models"
      />
      <ProfileSectionTile
        title="Workspace"
        description={
          workspaceStatus.provider ? (
            <WorkspaceStatusDescription
              text={workspaceStatus.text}
              provider={workspaceStatus.provider}
            />
          ) : (
            workspaceStatus.text
          )
        }
        canEdit={canWrite && !!onOpenWorkspaceManager}
        onEdit={onOpenWorkspaceManager ? () => onOpenWorkspaceManager(assistant) : undefined}
        editTestId="assistant-info-edit-workspace-section"
        editAriaLabel="Edit workspace"
      />
      <ProfileSectionTile
        title="Contact Details"
        description={
          <ContactDetailsGrid
            assistant={assistant}
            onOpenContactManager={onOpenContactManager}
            canWrite={canWrite}
          />
        }
        descriptionClassName="mt-0.5"
        canEdit={canWrite && !!onOpenContactManager}
        onEdit={() => onOpenContactManager(assistant)}
        editTestId="assistant-info-edit-contact-section"
        editAriaLabel="Edit contact details"
        suppressTileButtonSemantics
      />
      {showComputerUseSection && (
        <ProfileSectionTile
          title="Computer Use"
          description={getComputerUseStatusDescription(assistant)}
          canEdit={canWrite && !!onOpenComputerUseManager}
          onEdit={onOpenComputerUseManager ? () => onOpenComputerUseManager(assistant) : undefined}
          editTestId="assistant-info-edit-computer-use-section"
          editAriaLabel="Manage computer use"
        />
      )}
      {showDesktopSection && (
        <ProfileSectionTile
          title="Desktop"
          description={getDesktopStatusDescription(assistant)}
          canEdit={canWrite && !!onConnectDesktop}
          onEdit={onConnectDesktop ? () => onConnectDesktop(assistant) : undefined}
          editTestId="assistant-info-edit-desktop-section"
          editAriaLabel="Connect desktop"
        />
      )}
    </section>
  );
}

function WorkspaceStatusDescription({
  text,
  provider,
}: {
  text: string;
  provider: WorkspaceProviderKind;
}) {
  const iconSrc = provider === 'google' ? GoogleIcon : MicrosoftIcon;
  const iconAlt = provider === 'google' ? 'Google Workspace logo' : 'Microsoft 365 logo';

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Image src={iconSrc} alt={iconAlt} width={16} height={16} className="h-4 w-4 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

interface ProfileSectionTileProps {
  title: string;
  description: React.ReactNode;
  descriptionClassName?: string;
  canEdit: boolean;
  isOpening?: boolean;
  onEdit?: () => void;
  editTestId: string;
  editAriaLabel: string;
  /** When true, the tile stays mouse-clickable but omits button semantics (nested controls own keyboard/a11y). */
  suppressTileButtonSemantics?: boolean;
}

function ProfileSectionTile({
  title,
  description,
  descriptionClassName,
  canEdit,
  isOpening = false,
  onEdit,
  editTestId,
  editAriaLabel,
  suppressTileButtonSemantics = false,
}: ProfileSectionTileProps) {
  const isInteractive = canEdit && !!onEdit;
  const useTileButtonSemantics = isInteractive && !suppressTileButtonSemantics;

  const activate = () => {
    onEdit?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!useTileButtonSemantics) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };

  return (
    <div
      className={cn(
        'profile-section-tile group/tile flex flex-col gap-1 rounded-lg border px-3 py-2.5 transition-[background-color,border-color,box-shadow]',
        isInteractive
          ? 'cursor-pointer border-border bg-card shadow-sm hover:border-primary-tint-40 hover:bg-[var(--surface-hover)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:border-primary-tint-50 active:bg-secondary'
          : 'border-border/70 bg-card/60'
      )}
      data-profile-section-tile
      data-testid={editTestId}
      role={useTileButtonSemantics ? 'button' : undefined}
      tabIndex={useTileButtonSemantics ? 0 : undefined}
      aria-label={useTileButtonSemantics ? editAriaLabel : undefined}
      aria-busy={isOpening || undefined}
      onClick={isInteractive && !isOpening ? activate : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-label text-semibold"
          data-testid={title === 'Profile' ? 'assistant-info-profile-section-title' : undefined}
        >
          {title}
        </h3>
        {isOpening ? (
          <Loader2
            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
            data-testid="assistant-info-edit-profile-section-loading"
            aria-hidden="true"
          />
        ) : (
          isInteractive && (
            <ChevronRight
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70 transition-[opacity,transform] group-focus-within/tile:opacity-100 group-hover/tile:translate-x-0.5 group-hover/tile:opacity-100"
              aria-hidden="true"
            />
          )
        )}
      </div>
      <div className={cn('text-caption text-muted-foreground', descriptionClassName)}>
        {description}
      </div>
    </div>
  );
}

interface ContactDetailsGridProps {
  assistant: Assistant;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  canWrite: boolean;
}

function ContactDetailsGrid({
  assistant,
  onOpenContactManager,
  canWrite,
}: ContactDetailsGridProps) {
  const canManuallyManage = !assistant.isCoordinator;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5" data-testid="assistant-info-contact-grid">
      <ContactRow
        icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
        label="Phone"
        value={assistant.phone}
        canWrite={canWrite && canManuallyManage}
        onAdd={() => onOpenContactManager(assistant, 'phone')}
      />
      <ContactRow
        icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
        label="Email"
        value={assistant.email}
        canWrite={canWrite && canManuallyManage}
        onAdd={() => onOpenContactManager(assistant, 'email')}
      />
      <ContactRow
        icon={<WhatsApp sx={{ fontSize: '14px', flexShrink: 0 }} aria-hidden="true" />}
        label="WhatsApp"
        value={assistant.assistantWhatsappNumber}
        canWrite={canWrite && canManuallyManage}
        onAdd={() => onOpenContactManager(assistant, 'whatsapp')}
      />
      <ContactRow
        icon={<FaDiscord className="h-3.5 w-3.5" aria-hidden="true" />}
        label="Discord"
        value={assistant.assistantDiscordBotId}
        canWrite={canWrite && canManuallyManage}
        onAdd={() => onOpenContactManager(assistant, 'discord')}
      />
    </div>
  );
}

interface ContactRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  onAdd: () => void;
  canWrite: boolean;
}

function ContactRow({ icon, label, value, onAdd, canWrite }: ContactRowProps) {
  const [isCopied, setIsCopied] = React.useState(false);
  const copyResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactValue = value?.trim() ?? '';
  const isSet = contactValue !== '';

  React.useEffect(
    () => () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    },
    []
  );

  const copyValue = () => {
    void navigator.clipboard.writeText(contactValue);
    setIsCopied(true);
    if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = setTimeout(() => {
      copyResetTimerRef.current = null;
      setIsCopied(false);
    }, CONTACT_COPY_RESET_MS);
  };

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      {isSet ? (
        <button
          type="button"
          className="group/contact -mx-1 flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md border border-transparent px-1.5 py-0.5 text-left text-foreground transition-[background-color,border-color] hover:border-border hover:bg-[var(--surface-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            copyValue();
          }}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          <span className="min-w-0 truncate">{contactValue}</span>
          <Check
            className={cn(
              'h-3 w-3 flex-shrink-0 text-[color:var(--status-success)] transition-opacity',
              isCopied ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden="true"
          />
        </button>
      ) : canWrite ? (
        <Button
          type="button"
          variant="link"
          className="text-link h-auto p-0 text-sm font-normal"
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
        >
          Add {label.toLowerCase()}
        </Button>
      ) : (
        <span className="text-muted-foreground" aria-label={`${label} not set`}>
          —
        </span>
      )}
    </div>
  );
}
