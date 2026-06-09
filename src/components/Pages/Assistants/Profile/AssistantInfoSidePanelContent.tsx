import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Mail, Phone, Copy, Check, Pencil, Lock } from 'lucide-react';

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
import {
  useAssistantOnboardingState,
  type OnboardingDerivationContext,
} from '@/hooks/Assistants/useAssistantOnboardingState';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { CoordinatorOnboardingChecklist } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingChecklist';

export interface AssistantInfoSidePanelContentProps {
  assistant: Assistant;
  currentUserId?: string | null;
  /** Open the edit-profile dialog (wired from page-level Main).
   *  Suppressed when `canWrite === false` regardless of whether a
   *  handler is provided — the affordance vanishes from the header. */
  onEditProfile?: (assistant: Assistant) => void;
  /** Open the contact manager dialog, optionally on a specific channel tab. */
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  /**
   * Whether the viewer can edit this assistant. Drives the visibility
   * of every edit affordance the panel surfaces:
   *   - the IdentityHeader's pencil (profile edit)
   *   - the Contact Info section's "Edit" button
   *   - per-channel "Add phone / email / …" inline CTAs (read-only
   *     viewers see a quiet "—" placeholder instead)
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
    onShowInstallInstructions: (assistant: Assistant) => void;
    /** Optionally accepts a tab id (mirrors `/account?tab=…`) so
     *  callers can deep-link into a specific section of the account
     *  page — e.g. the phone-on-profile step uses `'contact-info'`. */
    onOpenUserSettings: (tab?: string) => void;
    onSeedChatDraft: (text: string) => void;
  };
  /** Coordinator-specific onboarding wiring. When this assistant is
   * the canonical workspace Coordinator and ``Coordinator/State.mode
   * === 'onboarding'``, the info panel surfaces an "Onboarding"
   * sub-tab that renders the gradual-onboarding steps (the same
   * one that lives in ``CoordinatorOnboarding`` while the alternate
   * /assistants shell is mounted). The hook bag carries the action
   * handlers the rows need — the actual progress state is read from
   * ``CoordinatorOnboardingContext`` so it stays in sync across
   * surfaces. Unset means the new tab won't render even for the
   * coordinator (e.g. on non-owner viewers). */
  coordinatorOnboarding?: {
    onConnectWorkspace?: () => void;
    onConnectApps?: () => void;
    onActNow?: () => void;
    onScheduleTask?: () => void;
    onHireSpecialist?: () => void;
    /** Surfaces a "Resume onboarding" CTA at the bottom of the
     * onboarding sub-tab. Wired only when the Coordinator/State row
     * is in ``working`` mode — i.e. the user already skipped or
     * completed onboarding once and we want to offer them a way to
     * jump back into the gradual flow (which flips ``mode`` back to
     * ``onboarding`` server-side and re-shows the alternate
     * /assistants shell). Undefined when there's nothing to resume
     * (e.g. the user is still in the gradual flow), in which case
     * the CTA is suppressed. */
    onResumeOnboarding?: () => void;
  };
  className?: string;
}

const COORDINATOR_COPY_RESET_MS = 2000;

/**
 * Body of the chat-tab assistant info side panel.
 *
 * Two-zone layout:
 *   1. A non-interactive identity header (avatar, name, supervisor,
 *      copy-id) with a single icon-only Edit button in the top-right
 *      corner. Tapping the header itself does nothing — the explicit
 *      pencil is the only edit affordance, which keeps the header
 *      purely informational.
 *   2. A tabbed body. While onboarding is in progress we render two
 *      tabs (Onboarding / Contact Info); the moment every onboarding
 *      step resolves we drop the tab strip entirely and show Contact
 *      Info inline. This is the "panel progressively settles into its
 *      standard shape" arc.
 *
 * The "Profile" section from the previous design was removed — its
 * data (job title, about) is editable through the Edit dialog and
 * doesn't need a static panel section to live in.
 */
export function AssistantInfoSidePanelContent({
  assistant,
  ...props
}: AssistantInfoSidePanelContentProps) {
  if (assistant.isCoordinator === true) {
    return (
      <CoordinatorAssistantInfoSidePanelContent
        assistant={assistant}
        onEditProfile={props.onEditProfile}
        className={props.className}
        onOpenContactManager={props.onOpenContactManager}
        canWrite={props.canWrite}
        coordinatorOnboarding={props.coordinatorOnboarding}
      />
    );
  }

  return <RegularAssistantInfoSidePanelContent assistant={assistant} {...props} />;
}

type CoordinatorPanelTab = 'onboarding' | 'contact';

function CoordinatorAssistantInfoSidePanelContent({
  assistant,
  onEditProfile,
  onOpenContactManager,
  className,
  canWrite = true,
  coordinatorOnboarding,
}: {
  assistant: Assistant;
  onEditProfile?: (assistant: Assistant) => void;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  className?: string;
  canWrite?: boolean;
  coordinatorOnboarding?: AssistantInfoSidePanelContentProps['coordinatorOnboarding'];
}) {
  const showOnboardingTab = !!coordinatorOnboarding;

  const [isIdCopied, setIsIdCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<CoordinatorPanelTab>(
    showOnboardingTab ? 'onboarding' : 'contact'
  );
  React.useEffect(() => {
    if (!showOnboardingTab && activeTab === 'onboarding') setActiveTab('contact');
  }, [showOnboardingTab, activeTab]);

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
    <ScrollArea className={cn('flex-1', className)}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <IdentityHeader
          name="Marty"
          photoSrc={undefined}
          initials="CO"
          summary="Your personal helper"
          visibilityLabel={
            <span className="inline-flex items-center gap-1">
              Only you
              <Lock className="h-3 w-3" aria-hidden="true" />
            </span>
          }
          isIdCopied={isIdCopied}
          onCopyId={copyId}
          onEdit={canWrite && onEditProfile ? () => onEditProfile(assistant) : undefined}
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
              <TabsTrigger
                value="onboarding"
                data-testid="assistant-info-tab-onboarding"
                className={PANEL_TAB_TRIGGER_CLASS}
              >
                Onboarding
              </TabsTrigger>
              <TabsTrigger
                value="contact"
                data-testid="assistant-info-tab-contact"
                className={PANEL_TAB_TRIGGER_CLASS}
              >
                Contact info
              </TabsTrigger>
            </TabsList>
            {coordinatorOnboarding && (
              <TabsContent value="onboarding" className="mt-0">
                <CoordinatorOnboardingChecklist
                  onConnectWorkspace={coordinatorOnboarding.onConnectWorkspace}
                  onConnectApps={coordinatorOnboarding.onConnectApps}
                  onActNow={coordinatorOnboarding.onActNow}
                  onScheduleTask={coordinatorOnboarding.onScheduleTask}
                  onHireSpecialist={coordinatorOnboarding.onHireSpecialist}
                />
                {coordinatorOnboarding.onResumeOnboarding && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={coordinatorOnboarding.onResumeOnboarding}
                      data-testid="coordinator-onboarding-resume"
                    >
                      Resume onboarding →
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}
            <TabsContent value="contact" className="mt-0">
              <ContactInfoGrid
                assistant={assistant}
                onOpenContactManager={onOpenContactManager}
                canWrite={canWrite}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <ContactInfoGrid
            assistant={assistant}
            onOpenContactManager={onOpenContactManager}
            canWrite={canWrite}
          />
        )}
      </div>
    </ScrollArea>
  );
}

function RegularAssistantInfoSidePanelContent({
  assistant,
  onEditProfile,
  onOpenContactManager,
  roadmap,
  className,
  canWrite = true,
  currentUserId,
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

  // Controlled tab state so we can auto-switch to Contact Info the
  // moment Onboarding completes (otherwise the user would see an
  // empty body until they manually clicked the surviving tab).
  const [activeTab, setActiveTab] = React.useState<'onboarding' | 'contact'>(
    showOnboardingTab ? 'onboarding' : 'contact'
  );
  React.useEffect(() => {
    if (!showOnboardingTab && activeTab === 'onboarding') setActiveTab('contact');
    if (showOnboardingTab && activeTab === 'contact' && onboardingState.resolvedSteps === 0) {
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

  const contactInfoBody = (
    <ContactInfoGrid
      assistant={assistant}
      onOpenContactManager={onOpenContactManager}
      canWrite={canWrite}
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
          onEdit={canWrite && onEditProfile ? () => onEditProfile(assistant) : undefined}
        />

        {showOnboardingTab && roadmap ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'onboarding' | 'contact')}
            className="flex flex-col gap-3"
          >
            {/* Tab strip — underlined style mirroring the right pane.
                The TabsList draws the baseline border so the active
                trigger's 2px underline can sit flush on top of it
                (same `items-end` trick the right pane uses). */}
            <TabsList className="h-8 w-full items-end justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger
                value="onboarding"
                data-testid="assistant-info-tab-onboarding"
                className={PANEL_TAB_TRIGGER_CLASS}
              >
                Onboarding
                <span
                  className="text-label bg-primary/15 ml-1.5 rounded-full px-1.5 py-0.5 text-primary"
                  data-testid="assistant-info-tab-onboarding-counter"
                >
                  {onboardingState.totalSteps - onboardingState.resolvedSteps}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="contact"
                data-testid="assistant-info-tab-contact"
                className={PANEL_TAB_TRIGGER_CLASS}
              >
                Contact info
              </TabsTrigger>
            </TabsList>
            <TabsContent value="onboarding" className="mt-0">
              <AssistantSetupRoadmap
                assistant={assistant}
                state={onboardingState}
                onOpenContactManager={onOpenContactManager}
                onStartCall={roadmap.onStartCall}
                onShowInstallInstructions={roadmap.onShowInstallInstructions}
                onOpenUserSettings={roadmap.onOpenUserSettings}
                onSeedChatDraft={roadmap.onSeedChatDraft}
                userEmail={roadmap.userEmail}
                userPhoneNumber={roadmap.userPhoneNumber}
              />
            </TabsContent>
            <TabsContent value="contact" className="mt-0">
              {contactInfoBody}
            </TabsContent>
          </Tabs>
        ) : (
          contactInfoBody
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
  summary?: React.ReactNode;
  visibilityLabel: React.ReactNode;
  isIdCopied: boolean;
  onCopyId: () => void;
  onEdit?: () => void;
  avatarNode?: React.ReactNode;
}

function IdentityHeader({
  name,
  photoSrc,
  initials,
  supervisorName,
  summary,
  visibilityLabel,
  isIdCopied,
  onCopyId,
  onEdit,
  avatarNode,
}: IdentityHeaderProps) {
  const metadataRowClass =
    'text-caption grid min-w-0 grid-cols-[10ch_minmax(0,1fr)] items-center gap-x-1 text-muted-foreground';

  return (
    <div className="flex items-start gap-3">
      {avatarNode ?? (
        <Avatar className="h-14 w-14 flex-shrink-0 rounded-md">
          <AvatarImage src={photoSrc} alt={name} className="rounded-md" />
          <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-title truncate" data-testid="assistant-info-name">
          {name}
        </div>
        {summary ? (
          <div className={metadataRowClass}>
            <span className="opacity-70">Role:</span>
            <span className="truncate">{summary}</span>
          </div>
        ) : supervisorName ? (
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
          aria-label="Copy martian ID"
        >
          <span className="opacity-70">Martian ID:</span>
          <span className="flex min-w-0 items-center">
            {isIdCopied ? (
              <Check className="h-3 w-3 flex-shrink-0 text-[color:var(--status-success)]" />
            ) : (
              <Copy className="h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover/id:opacity-100" />
            )}
          </span>
        </button>
      </div>
      {onEdit && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-1 -mt-1 h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onEdit}
                data-testid="assistant-info-edit-profile"
                aria-label="Edit profile"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Edit profile</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

interface ContactInfoGridProps {
  assistant: Assistant;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  /** When false, the grid renders read-only — no Edit button, no per-channel Add CTAs. */
  canWrite: boolean;
}

/**
 * Two-column contact grid. Mirrors what used to live inside the
 * deprecated "Contacts" section, just lifted into its own block so
 * the same UI is shared between the tabbed and tabless states.
 *
 * For viewers without write permission (e.g. org members looking at
 * a teammate's assistant) the section flips to a strictly read-only
 * presentation: the section's "Edit" button disappears and unset
 * channels render a neutral "—" placeholder instead of an actionable
 * "Add …" link. Hiding the affordances entirely is preferable to
 * disabling them — a disabled Add link would just invite confusion
 * about why the action isn't allowed.
 */
function ContactInfoGrid({ assistant, onOpenContactManager, canWrite }: ContactInfoGridProps) {
  const canManuallyManageWhatsapp = !assistant.isCoordinator;
  return (
    <section className="flex flex-col gap-2.5" data-testid="assistant-info-contact-grid">
      <div className="flex items-center justify-between border-b pb-1.5">
        <h3 className="text-label text-semibold">Contact info</h3>
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-caption -mr-2 h-7 gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenContactManager(assistant)}
            data-testid="assistant-info-manage-contacts"
            aria-label="Manage contact details"
          >
            <Pencil className="h-3 w-3" />
            <span>Edit</span>
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <ContactRow
          icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Phone"
          value={assistant.phone}
          canWrite={canWrite}
          onAdd={() => onOpenContactManager(assistant, 'phone')}
        />
        <ContactRow
          icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Email"
          value={assistant.email}
          canWrite={canWrite}
          renderValue={(v) => (
            <a href={`mailto:${v}`} className="text-link min-w-0 truncate">
              {v}
            </a>
          )}
          onAdd={() => onOpenContactManager(assistant, 'email')}
        />
        <ContactRow
          icon={<WhatsApp sx={{ fontSize: '14px', flexShrink: 0 }} aria-hidden="true" />}
          label="WhatsApp"
          value={assistant.assistantWhatsappNumber}
          canWrite={canWrite && canManuallyManageWhatsapp}
          onAdd={() => onOpenContactManager(assistant, 'whatsapp')}
        />
        <ContactRow
          icon={<FaDiscord className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Discord"
          value={assistant.assistantDiscordBotId}
          canWrite={canWrite}
          onAdd={() => onOpenContactManager(assistant, 'discord')}
        />
      </div>
    </section>
  );
}

interface ContactRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  /** Custom renderer for the populated value (e.g. mailto link). */
  renderValue?: (value: string) => React.ReactNode;
  onAdd: () => void;
  canWrite: boolean;
}

function ContactRow({ icon, label, value, renderValue, onAdd, canWrite }: ContactRowProps) {
  const isSet = !!value && value.trim() !== '';
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      {isSet ? (
        renderValue ? (
          renderValue(value as string)
        ) : (
          <span className="min-w-0 truncate">{value}</span>
        )
      ) : canWrite ? (
        <Button
          type="button"
          variant="link"
          className="text-link h-auto p-0 text-sm font-normal"
          onClick={onAdd}
        >
          Add {label.toLowerCase()}
        </Button>
      ) : (
        // Read-only viewers: neutral em-dash placeholder, no
        // affordance, with an aria-label so AT users still hear
        // which channel is empty.
        <span className="text-muted-foreground" aria-label={`${label} not set`}>
          —
        </span>
      )}
    </div>
  );
}
