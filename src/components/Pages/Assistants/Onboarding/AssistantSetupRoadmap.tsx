/**
 * AssistantSetupRoadmap — the post-hire setup checklist that lives in
 * the "Onboarding" tab of the assistant info side panel.
 *
 * Design intent: the panel itself is the onboarding surface. As steps
 * resolve (the user configures a channel, sends their first message,
 * makes a voice call, etc.), atomic sub-steps tick off the progress
 * bar and groups collapse with a checkmark. When everything is
 * resolved the parent panel removes the Onboarding tab entirely and
 * falls back to pure Contact Info.
 *
 * Architecture:
 *   - Per-step config + completion detection lives in
 *     `useAssistantOnboardingState`. This component is the visual
 *     layer plus action wiring.
 *   - Groups render as accordion sections; the first incomplete group
 *     is expanded by default and groups auto-collapse on completion.
 *   - Each step row is a single clickable button (no separate primary
 *     CTA), keeping the panel narrow and reducing visual noise.
 *   - The "Integrations" group is a special row of platform launcher
 *     buttons (Google / Teams / Azure / Other) plus a manual
 *     "Mark all set" affordance — there's no reliable backend signal
 *     for "user finished setting up integrations", so we let them
 *     declare done.
 */

import * as React from 'react';
import {
  MessageSquare,
  Phone,
  PhoneCall,
  Mail,
  MailPlus,
  UserCog,
  Plug,
  Check,
  ChevronRight,
  Inbox,
  UserPlus,
} from 'lucide-react';
import {
  FaAws,
  FaConfluence,
  FaGithub,
  FaGoogle,
  FaJira,
  FaMicrosoft,
  FaSalesforce,
  FaSlack,
} from 'react-icons/fa';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import type {
  OnboardingGroupId,
  OnboardingStep,
  OnboardingStepId,
  OnboardingGroup,
  UseAssistantOnboardingStateResult,
} from '@/hooks/Assistants/useAssistantOnboardingState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Loose equality check for two email addresses, used by the
 * `emailAsk` prefill to detect "the assistant's connected mailbox is
 * the user's own personal mailbox" — in which case asking the
 * assistant to send a test email to the user is a self-send and
 * mostly noise. We collapse case + whitespace, and strip Gmail's
 * dot-and-`+tag` aliases so e.g. `user@example.com` and
 * `user@example.com` resolve as the same inbox.
 *
 * Returns false on either side missing — onboarding falls back to
 * the generic test-email prefill, which is the safer default.
 */
function sameMailbox(a?: string | null, b?: string | null): boolean {
  const norm = (e?: string | null): string => {
    if (!e) return '';
    const [local, domain] = e.trim().toLowerCase().split('@');
    if (!local || !domain) return '';
    const stripped = local.split('+')[0];
    return `${domain === 'gmail.com' ? stripped.replace(/\./g, '') : stripped}@${domain}`;
  };
  const aN = norm(a);
  const bN = norm(b);
  return !!aN && aN === bN;
}

// ---------------------------------------------------------------------------
// Per-step / per-group display metadata
// ---------------------------------------------------------------------------

interface StepMeta {
  label: (assistant: Assistant) => string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STEP_META: Record<Exclude<OnboardingStepId, 'integrations'>, StepMeta> = {
  hire: {
    label: (a) => `Hired ${a.firstName || 'them'}`,
    Icon: UserPlus,
  },
  sayHi: {
    label: () => 'Say hi with a first message',
    Icon: MessageSquare,
  },
  voiceCall: {
    label: (a) => `Start a voice call with ${a.firstName || 'them'}`,
    Icon: PhoneCall,
  },
  email: {
    label: (a) => `Give ${a.firstName || 'them'} an email address`,
    Icon: Mail,
  },
  emailAsk: {
    label: (a) => `Ask ${a.firstName || 'them'} to send an email`,
    Icon: MailPlus,
  },
  phoneOnProfile: {
    label: () => 'Add a phone number to your profile',
    Icon: UserCog,
  },
  phone: {
    label: (a) => `Give ${a.firstName || 'them'} a phone number`,
    Icon: Phone,
  },
  phoneAsk: {
    label: (a) => `Ask ${a.firstName || 'them'} to give you a phone call`,
    Icon: PhoneCall,
  },
};

const GROUP_TITLES: Record<OnboardingGroupId, (assistant: Assistant) => string> = {
  started: () => 'Get started',
  breakIce: () => 'Break the ice',
  exchangeEmails: () => 'Exchange emails',
  getOnCall: () => 'Get on a call',
  integrations: (a) => `Give ${a.firstName || 'them'} access to your platforms`,
};

const GROUP_ICONS: Record<OnboardingGroupId, React.ComponentType<{ className?: string }>> = {
  started: UserPlus,
  breakIce: MessageSquare,
  exchangeEmails: Inbox,
  getOnCall: Phone,
  integrations: Plug,
};

// Steps that map directly to a contact-manager tab.
const CHANNEL_TO_CONTACT: Partial<Record<OnboardingStepId, ContactType>> = {
  email: 'email',
  phone: 'phone',
};

/**
 * Renders the disabled-state tooltip text for a step whose
 * `prerequisiteStepId` (computed by the hook) isn't yet satisfied.
 * The hook owns the dependency graph; we just turn it into a friendly
 * sentence here so the prereq label stays in sync with `STEP_META`
 * (rename a step's label once and both the row text and the tooltip
 * follow).
 *
 * We deliberately keep the visible step but disable interaction +
 * surface a tooltip — hiding the row entirely would make the visible
 * "X of N" count fluctuate as the user configures channels, which
 * reads as a moving target.
 */
function getDisabledReason(assistant: Assistant, step: OnboardingStep): string | undefined {
  if (!step.prerequisiteStepId) return undefined;
  // `STEP_META` deliberately excludes 'integrations' (the integrations
  // group renders its own bespoke body, not a row), and integrations
  // never appears as a prerequisite, so this lookup is always defined
  // in practice. The guard keeps us safe if that invariant ever
  // changes — better a missing tooltip than a render crash.
  const prereqMeta =
    step.prerequisiteStepId === 'integrations' ? undefined : STEP_META[step.prerequisiteStepId];
  if (!prereqMeta) return undefined;
  return `Complete "${prereqMeta.label(assistant)}" first`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssistantSetupRoadmapProps {
  assistant: Assistant;
  /**
   * Lifted hook state. The parent panel calls
   * `useAssistantOnboardingState` once and threads the result here so
   * `markResolved` writes from this component propagate back into the
   * panel's tab-visibility decision in the same render.
   */
  state: UseAssistantOnboardingStateResult;
  // Action handlers ------------------------------------------------------
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  onStartCall: (assistant: Assistant, type: 'audio' | 'video') => void;
  /**
   * Open the user's account settings, optionally on a specific
   * sub-tab (mirrors `/account?tab=...`). The phone-on-profile step
   * passes `'contact-info'` so the user lands directly on the right
   * section.
   */
  onOpenUserSettings: (tab?: string) => void;
  onSeedChatDraft: (text: string) => void;
  // Prefill text helpers (no plumbing if missing — the prompt just
  // gets a slightly more generic phrasing) ------------------------------
  userEmail?: string | null;
  userPhoneNumber?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssistantSetupRoadmap({
  assistant,
  state,
  onOpenContactManager,
  onStartCall,
  onOpenUserSettings,
  onSeedChatDraft,
  userEmail,
  userPhoneNumber,
}: AssistantSetupRoadmapProps) {
  const { groups, totalSteps, resolvedSteps, shouldShowRoadmap, recordPrefillClick } = state;

  // Controlled accordion state. Initialise to the first incomplete
  // group so the user lands directly on actionable work; auto-collapse
  // any group that transitions to complete (small reward + cleaner
  // visual). Tracking lastSeenComplete prevents the effect from
  // fighting user toggles after the transition.
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>([]);
  const lastSeenCompleteRef = React.useRef<Set<OnboardingGroupId>>(new Set());

  React.useEffect(() => {
    lastSeenCompleteRef.current = new Set();
    const firstIncomplete = groups.find((g) => !g.isComplete);
    setExpandedGroups(firstIncomplete ? [firstIncomplete.id] : []);
    for (const g of groups) {
      if (g.isComplete) lastSeenCompleteRef.current.add(g.id);
    }
    // Intentionally only depend on assistant id — full `groups` would
    // refire on every prop change and stomp the user's toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistant.agentId]);

  React.useEffect(() => {
    let next = expandedGroups;
    let firstNewlyIncomplete: OnboardingGroupId | null = null;
    for (const g of groups) {
      const wasComplete = lastSeenCompleteRef.current.has(g.id);
      if (g.isComplete && !wasComplete) {
        if (next.includes(g.id)) next = next.filter((id) => id !== g.id);
        lastSeenCompleteRef.current.add(g.id);
        if (firstNewlyIncomplete === null) {
          const idx = groups.findIndex((x) => x.id === g.id);
          for (let i = idx + 1; i < groups.length; i++) {
            if (!groups[i].isComplete) {
              firstNewlyIncomplete = groups[i].id;
              break;
            }
          }
        }
      } else if (!g.isComplete && wasComplete) {
        lastSeenCompleteRef.current.delete(g.id);
      }
    }
    if (firstNewlyIncomplete && !next.includes(firstNewlyIncomplete)) {
      next = [...next, firstNewlyIncomplete];
    }
    if (next !== expandedGroups) setExpandedGroups(next);
  }, [groups, expandedGroups]);

  if (!shouldShowRoadmap) return null;

  // ---- Action handlers ------------------------------------------------

  const handleStepAction = (step: OnboardingStep) => {
    switch (step.id) {
      case 'sayHi': {
        onSeedChatDraft(`Hi ${assistant.firstName || 'there'}!`);
        return;
      }
      case 'voiceCall': {
        onStartCall(assistant, 'audio');
        return;
      }
      case 'email': {
        onOpenContactManager(assistant, CHANNEL_TO_CONTACT[step.id]);
        return;
      }
      case 'emailAsk': {
        // BYOD email: when the assistant is connected to the user's
        // own mailbox, a "send me a test email" round-trip is still
        // a self-send (same From and To) but Gmail / MS365 handle
        // that fine, so we ask for a summary-by-email instead. That
        // exercises both the read scope (fetching the inbox) and
        // the send scope (delivering the summary), and leaves the
        // user with a durable artifact in their inbox rather than
        // an ephemeral chat reply. When the mailbox is distinct
        // (e.g. a dedicated `assistant@…` BYOD address or a shared
        // inbox), the plain test-email prompt remains the cleanest
        // verification.
        const greeting = `Hi ${assistant.firstName || 'there'}`;
        const prompt = sameMailbox(assistant.email, userEmail)
          ? `${greeting}, can you email me a summary of my most recent emails?`
          : `${greeting}, can you send me a test email${
              userEmail?.trim() ? ` at ${userEmail.trim()}` : ''
            }?`;
        onSeedChatDraft(prompt);
        recordPrefillClick(step.id);
        return;
      }
      case 'phoneOnProfile': {
        // Deep-link to the Contact Info tab on the account page so
        // the user doesn't have to hunt for the phone-number field.
        onOpenUserSettings('contact-info');
        return;
      }
      case 'phone': {
        onOpenContactManager(assistant, CHANNEL_TO_CONTACT[step.id]);
        return;
      }
      case 'phoneAsk': {
        const target = userPhoneNumber?.trim() ? ` at ${userPhoneNumber.trim()}` : '';
        onSeedChatDraft(
          `Hi ${assistant.firstName || 'there'}, can you give me a quick call${target}?`
        );
        recordPrefillClick(step.id);
        return;
      }
      case 'integrations':
        // The integrations group renders its own bespoke content; the
        // generic per-step row never invokes this branch.
        return;
    }
  };

  return (
    <section
      data-testid="assistant-setup-roadmap"
      aria-label="Assistant setup checklist"
      className="flex flex-col gap-3"
    >
      {/* Progress header ------------------------------------------------ */}
      <header className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-label text-semibold">Setup progress</span>
          <span className="text-caption" data-testid="assistant-setup-roadmap-progress-text">
            {resolvedSteps} of {totalSteps} done
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${totalSteps === 0 ? 0 : (resolvedSteps / totalSteps) * 100}%`,
            }}
          />
        </div>
      </header>

      {/* Groups --------------------------------------------------------- */}
      <ul className="flex flex-col" data-testid="assistant-setup-roadmap-groups">
        {groups.map((group) => (
          <RoadmapGroup
            key={group.id}
            assistant={assistant}
            group={group}
            isExpanded={expandedGroups.includes(group.id)}
            onToggle={() =>
              setExpandedGroups((prev) =>
                prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id]
              )
            }
            onStepAction={handleStepAction}
            onSeedChatDraft={onSeedChatDraft}
          />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Group + row primitives
// ---------------------------------------------------------------------------

interface RoadmapGroupProps {
  assistant: Assistant;
  group: OnboardingGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onStepAction: (step: OnboardingStep) => void;
  onSeedChatDraft: (text: string) => void;
}

function RoadmapGroup({
  assistant,
  group,
  isExpanded,
  onToggle,
  onStepAction,
  onSeedChatDraft,
}: RoadmapGroupProps) {
  const Icon = GROUP_ICONS[group.id];
  const title = GROUP_TITLES[group.id](assistant);
  // Optional steps (e.g. integrations) never count toward "X left",
  // and a group made entirely of optional steps never reads as
  // "complete" with a checkmark — it's a perpetual reference rather
  // than a checklist item.
  const countableSteps = group.steps.filter((s) => !s.isOptional);
  const remaining = countableSteps.filter((s) => !s.isResolved).length;
  const isAllOptional = countableSteps.length === 0;

  return (
    <li
      className="border-b last:border-b-0"
      data-testid={`assistant-setup-roadmap-group-${group.id}`}
      data-status={group.isComplete ? 'complete' : 'incomplete'}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        data-testid={`assistant-setup-roadmap-group-${group.id}-toggle`}
        className="hover:bg-muted/40 flex w-full items-center gap-2 py-2.5 text-left transition-colors"
      >
        {/* Icon-only header — no circular bg. The completed state
            promotes the icon to the primary accent color (and swaps
            in a checkmark) so it's clearly differentiated without
            the visual weight of a filled chip. */}
        <span
          className={cn(
            'flex h-4 w-4 flex-shrink-0 items-center justify-center',
            group.isComplete ? 'text-primary' : 'text-muted-foreground'
          )}
          aria-hidden="true"
        >
          {group.isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        {/* Category title — text-sm semibold, larger than item rows
            so the hierarchy reads category > items at a glance. */}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-semibold',
            group.isComplete && 'text-muted-foreground line-through'
          )}
        >
          {title}
        </span>
        {!group.isComplete && !isAllOptional && (
          <span className="text-caption">{remaining} left</span>
        )}
        <ChevronRight
          className={cn(
            'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90'
          )}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div className="pb-3 pl-4 pr-1">
          {group.id === 'integrations' ? (
            <IntegrationsBody assistant={assistant} onSeedChatDraft={onSeedChatDraft} />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {group.steps.map((step) => (
                <RoadmapStepRow
                  key={step.id}
                  assistant={assistant}
                  step={step}
                  // Disable "Ask in chat" rows whose underlying
                  // channel isn't configured yet — pinging an
                  // assistant for a callback they have no phone for
                  // is a guaranteed dead end. The tooltip explains
                  // exactly which prerequisite is missing so the
                  // disabled state is never mysterious.
                  disabledReason={getDisabledReason(assistant, step)}
                  onAction={() => onStepAction(step)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

interface RoadmapStepRowProps {
  assistant: Assistant;
  step: OnboardingStep;
  /** Human-readable reason the step isn't actionable yet (e.g. a
   *  prerequisite channel hasn't been configured). When set, the row
   *  is non-interactive and a tooltip explains why on hover. */
  disabledReason?: string;
  onAction: () => void;
}

/**
 * Single sub-step row. The entire row is the action button — there's
 * no separate primary CTA since the description already names the
 * action. Resolved rows render as a non-interactive line item.
 *
 * Visual rules:
 *   - Items are text-xs (smaller than the text-sm group titles) to
 *     reinforce the category > items hierarchy.
 *   - No chevron on items — chevrons are reserved for foldable group
 *     headers, so the affordance reads as "the whole row is the
 *     button" without competing iconography.
 *   - Hover shifts the text from foreground → primary accent so the
 *     row visibly responds to the cursor (the change is small enough
 *     not to feel jumpy but unmistakable).
 *   - Disabled rows render at reduced opacity with `cursor-not-allowed`
 *     and a tooltip on hover/focus explaining the missing prereq.
 */
function RoadmapStepRow({ assistant, step, disabledReason, onAction }: RoadmapStepRowProps) {
  if (step.id === 'integrations') return null;
  const meta = STEP_META[step.id];
  const label = meta.label(assistant);

  const baseItemClasses = 'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs';

  if (step.isResolved) {
    return (
      <li
        className={cn(baseItemClasses, 'text-muted-foreground')}
        data-testid={`assistant-setup-roadmap-step-${step.id}`}
        data-status="done"
      >
        <span
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Check className="h-2.5 w-2.5" />
        </span>
        <span className="min-w-0 flex-1 truncate line-through">{label}</span>
      </li>
    );
  }

  if (disabledReason) {
    // Wrapping the disabled <button> in a tooltip trigger gives both
    // mouse + keyboard users the prerequisite hint without us having
    // to disable hover entirely. The button keeps its semantic role
    // (so AT users still hear "button, dimmed") but ignores clicks.
    return (
      <li data-testid={`assistant-setup-roadmap-step-${step.id}`} data-status="pending-blocked">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-testid={`assistant-setup-roadmap-step-${step.id}-action`}
                className={cn(
                  baseItemClasses,
                  'text-muted-foreground/70 cursor-not-allowed opacity-70'
                )}
              >
                <span
                  className="border-muted-foreground/30 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border bg-background"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-caption">{disabledReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </li>
    );
  }

  return (
    <li data-testid={`assistant-setup-roadmap-step-${step.id}`} data-status="pending">
      <button
        type="button"
        onClick={onAction}
        data-testid={`assistant-setup-roadmap-step-${step.id}-action`}
        className={cn(
          baseItemClasses,
          'hover:bg-muted/60 text-foreground transition-colors hover:text-primary'
        )}
      >
        <span
          className="border-muted-foreground/30 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border bg-background"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Integrations body — bespoke launcher row
// ---------------------------------------------------------------------------

interface IntegrationsBodyProps {
  assistant: Assistant;
  onSeedChatDraft: (text: string) => void;
}

/**
 * Per-platform launcher buttons. Each button seeds the chat with a
 * guided-walkthrough prompt rather than navigating the user away —
 * the assistant itself does the integration onboarding.
 *
 * The integrations step is intentionally optional and never auto-
 * resolves on click: integrations are an open-ended, ongoing surface
 * (you might add a new SaaS to your stack any week), not a one-shot
 * checkbox. The group simply stays available as a launcher.
 *
 * "Other…" gets a deliberately open-ended prompt that ends with
 * `on:` so the user can tab into the composer and name whatever
 * platform they care about.
 */
/**
 * Platform launcher catalog. Ordered roughly by enterprise category
 * (productivity → cloud → dev/code → business apps → docs) so the
 * grid reads top-to-bottom by mental cluster rather than alphabet.
 *
 * The `provider` string is what we drop into the chat prompt — it's
 * the human-readable name the assistant should recognize ("Microsoft
 * Teams", not "teams"), independent of the button's compact label.
 *
 * Adding a new platform is a one-liner: append an entry here. The
 * id doubles as the testid suffix so E2E selectors auto-cover it.
 */
const INTEGRATION_PLATFORMS: ReadonlyArray<{
  id: string;
  label: string;
  provider: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'google', label: 'Google', provider: 'Google', Icon: FaGoogle },
  { id: 'teams', label: 'Teams', provider: 'Microsoft Teams', Icon: FaMicrosoft },
  { id: 'slack', label: 'Slack', provider: 'Slack', Icon: FaSlack },
  { id: 'azure', label: 'Azure', provider: 'Azure', Icon: FaMicrosoft },
  { id: 'aws', label: 'AWS', provider: 'AWS', Icon: FaAws },
  { id: 'github', label: 'GitHub', provider: 'GitHub', Icon: FaGithub },
  { id: 'jira', label: 'Jira', provider: 'Jira', Icon: FaJira },
  { id: 'salesforce', label: 'Salesforce', provider: 'Salesforce', Icon: FaSalesforce },
  { id: 'confluence', label: 'Confluence', provider: 'Confluence', Icon: FaConfluence },
];

function IntegrationsBody({ assistant, onSeedChatDraft }: IntegrationsBodyProps) {
  const seedNamed = (provider: string) =>
    onSeedChatDraft(
      `Hey ${assistant.firstName || 'there'}, can you guide me through giving you access to my ${provider} account?`
    );
  const seedOther = () =>
    // Trailing colon + space = ready cursor target for the user to
    // type the platform name.
    onSeedChatDraft(
      `Hey ${assistant.firstName || 'there'}, can you guide me through giving you access to my account on: `
    );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption">
        Pick a platform to ask {assistant.firstName || 'them'} for help connecting it.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {INTEGRATION_PLATFORMS.map(({ id, label, provider, Icon }) => (
          <PlatformButton
            key={id}
            icon={<Icon className="h-3.5 w-3.5" />}
            label={label}
            onClick={() => seedNamed(provider)}
            testId={`assistant-setup-roadmap-integration-${id}`}
          />
        ))}
        <PlatformButton
          icon={<Plug className="h-3.5 w-3.5" />}
          label="Other…"
          onClick={seedOther}
          testId="assistant-setup-roadmap-integration-other"
        />
      </div>
    </div>
  );
}

interface PlatformButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}

function PlatformButton({ icon, label, onClick, testId }: PlatformButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 justify-start gap-2 text-xs"
      onClick={onClick}
      data-testid={testId}
    >
      <span className="text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </Button>
  );
}
