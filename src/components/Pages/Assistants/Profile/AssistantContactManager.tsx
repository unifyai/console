'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/UI/dialog';

import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import {
  Loader2,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Pencil,
  Plus,
  Slack,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/alert-dialog';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ContactType, OAuthProvider } from '@/types/assistants/contact';
import type { SlackInstall, SlackInstallOwner } from '@/types/slack/install';
import { useSlackIntegration } from '@/hooks/Slack/useSlackIntegration';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { FormProvider, useWatch } from 'react-hook-form';
import { FALLBACK_DEFAULT_COUNTRY_CODE } from '@/constants/assistants/settings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { getCountryFlag } from '@/utils/assistants/country-utils';
import { toast } from 'sonner';
import { WhatsApp } from '@mui/icons-material';
import { FaDiscord } from 'react-icons/fa';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/UI/tooltip';
import { InfoSquareButton } from '@/components/UI/info-square-button';
import { useAssistantContactManager } from '@/hooks/Assistants/useAssistantContactManager';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import { Badge } from '@/components/UI/badge';
import { Checkbox } from '@/components/UI/checkbox';
import { cn } from '@/lib/utils';
import GoogleIcon from '@/public/icons/google-icon.png';
import MicrosoftIcon from '@/public/icons/microsoft-icon.png';

interface AssistantContactManagerProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  onSuccess: () => void;
  initialTab?: ContactType | 'slack';
  /** Whether the current user can edit contact details */
  canWrite?: boolean;
  /** Callback to open the Stripe payment panel when credits are insufficient */
  onAddPaymentMethod?: () => void;
  /** Open the Workspace modal — wired by the Email tab's "Add/update
   *  config" CTA.  The OAuth connect flow lives there now; the Email
   *  tab is display-only. */
  onOpenWorkspaceManager?: (assistant: Assistant) => void;
  /** User's phone number from their profile */
  userPhoneNumber?: string | null;
  /** User's WhatsApp number from their profile */
  userWhatsappNumber?: string | null;
  /** User's Discord ID from their profile */
  userDiscordId?: string | null;
  /** Owner scope for the shared Slack install. ``null`` (or absent
   *  ``assistantActions.slack``) hides the Slack entry — e.g. when
   *  Slack OAuth isn't configured on the deployment. */
  slackOwner?: SlackInstallOwner | null;
  /** Whether the current user may connect/disconnect the workspace
   *  Slack install (org owner, or the personal-account owner). */
  slackCanManageInstall?: boolean;
  /** Server-prefetched shared Slack install for the active workspace. */
  slackInitialInstall?: SlackInstall | null;
  /** Open the user's account settings in a new tab (closes onboarding panel). */
  onOpenUserSettings?: (tab?: string) => void;
}

/**
 * Tabs shown in the contact manager. Extends the billable
 * ``ContactType`` set with the display-only ``slack`` entry, whose
 * connection is a shared workspace install rather than a per-assistant
 * contact row.
 */
type ContactManagerTab = ContactType | 'slack';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

export const DisplayContactField: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input value={value} readOnly disabled />
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={handleCopy}
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-[color:var(--status-success)]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy {label.toLowerCase()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

/* eslint-disable @typescript-eslint/naming-convention */
export const PROVIDER_LABELS: Record<string, string> = {
  google_workspace: 'Gmail',
  microsoft_365: 'Outlook 365',
  google: 'Google',
  microsoft: 'Microsoft 365',
};
/* eslint-enable @typescript-eslint/naming-convention */

const FEATURE_LABELS: Record<string, string> = {
  email: 'Email',
  teams: 'Teams',
  calendar: 'Calendar',
  drive: 'Drive',
  contacts: 'Contacts',
  sharepoint: 'SharePoint',
  tasks: 'Tasks',
};

export const ProviderBadge: React.FC<{ provider: string }> = ({ provider }) => (
  <Badge variant="secondary" className="ml-2 text-xs font-normal">
    {PROVIDER_LABELS[provider] ?? provider}
  </Badge>
);

const ContactReadyMessage: React.FC<{
  children: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ children, badge }) => (
  <div className="flex items-center gap-2">
    <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success)]" />
    <span className="text-body">{children}</span>
    {badge}
  </div>
);

const ProfileContactRequiredNotice: React.FC<{
  message: string;
  linkLabel: string;
  suffix: string;
  onOpenUserSettings?: (tab?: string) => void;
}> = ({ message, linkLabel, suffix, onOpenUserSettings }) => (
  <div className="border-muted-foreground/40 rounded-md border border-dashed p-3">
    <p className="text-body text-muted-foreground">
      {message}{' '}
      {onOpenUserSettings ? (
        <button
          type="button"
          className="text-primary underline hover:text-primary-tint-80"
          onClick={() => onOpenUserSettings('contact-info')}
        >
          {linkLabel}
        </button>
      ) : (
        <a
          href="/account?tab=contact-info"
          className="text-primary underline hover:text-primary-tint-80"
        >
          {linkLabel}
        </a>
      )}{' '}
      {suffix}
    </p>
  </div>
);

/**
 * One stacked contact-channel section (icon + label header, then content),
 * mirroring the user account contact form's layout so the two read alike.
 * ``data-contact-section`` lets deep links scroll their channel into view.
 */
const ContactSection: React.FC<{
  type: ContactManagerTab;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}> = ({ type, icon, label, children }) => (
  <section data-contact-section={type}>
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <Label>{label}</Label>
    </div>
    <div className="space-y-3">{children}</div>
  </section>
);

// ---------------------------------------------------------------------------
// BYOD provider picker cards
// ---------------------------------------------------------------------------

export const ByodProviderCard: React.FC<{
  provider: OAuthProvider;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /**
   * When set, the card is disabled and the reason is shown on hover. Used to keep
   * a provider visible (so users know it exists) when the deployment hasn't
   * configured its OAuth client, rather than hiding it.
   */
  unavailableReason?: string;
}> = ({ provider, isSelected, onSelect, disabled, unavailableReason }) => {
  const isGoogle = provider === 'google';
  const title = isGoogle ? 'Google Workspace' : 'Microsoft 365';
  const subtitle = isGoogle ? 'Gmail, Calendar, Drive' : 'Outlook, Teams, Calendar';
  const isDisabled = disabled || !!unavailableReason;

  const card = (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      className={cn(
        'flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 text-center shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--role-green-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected
          ? 'border-[color:var(--role-green-deep)] bg-[color:var(--status-success-bg)] ring-1 ring-[color:var(--role-green-deep)]'
          : 'border-border bg-card hover:border-[color:var(--role-green-deep)] hover:bg-[color:var(--status-success-bg)]',
        isDisabled && 'cursor-not-allowed opacity-50'
      )}
      aria-label={title}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border">
        <Image
          src={isGoogle ? GoogleIcon : MicrosoftIcon}
          alt={`${title} logo`}
          width={28}
          height={28}
          className="h-7 w-7"
        />
      </span>
      <span className="flex flex-col">
        <span className="text-body text-strong">{title}</span>
        <span className="text-caption text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );

  if (!unavailableReason) return card;

  // A disabled <button> doesn't emit hover events, so the tooltip has to trigger
  // off a wrapping span (which keeps the card's flex sizing).
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex flex-1">{card}</span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{unavailableReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ---------------------------------------------------------------------------
// Feature checklist
// ---------------------------------------------------------------------------

export const FeatureChecklist: React.FC<{
  features: string[];
  selected: string[];
  required: string[];
  onToggle: (feature: string) => void;
  disabled?: boolean;
}> = ({ features, selected, required, onToggle, disabled }) => {
  // Required features surface first (each group keeps its original order) so the
  // non-negotiable grants are the first thing the user sees.
  const orderedFeatures = React.useMemo(() => {
    const req = features.filter((f) => required.includes(f));
    const opt = features.filter((f) => !required.includes(f));
    return [...req, ...opt];
  }, [features, required]);

  return (
    <div className="space-y-2">
      {orderedFeatures.map((feature) => {
        const isRequired = required.includes(feature);
        const isChecked = selected.includes(feature);
        return (
          <label
            key={feature}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors',
              isChecked ? 'border-primary-tint-30 bg-primary-tint-5' : 'border-border',
              (isRequired || disabled) && 'cursor-default opacity-70'
            )}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => onToggle(feature)}
              disabled={isRequired || disabled}
            />
            <span className="text-body flex-1">{FEATURE_LABELS[feature] ?? feature}</span>
            {isRequired && <span className="text-caption text-muted-foreground">Required</span>}
          </label>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssistantContactManager({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  onSuccess,
  initialTab,
  canWrite = true,
  onAddPaymentMethod,
  onOpenWorkspaceManager,
  userPhoneNumber,
  userWhatsappNumber,
  userDiscordId,
  slackOwner = null,
  slackCanManageInstall = false,
  slackInitialInstall = null,
  onOpenUserSettings,
}: AssistantContactManagerProps) {
  const {
    // Self-contained form methods from the hook
    contactFormMethods,
    availablePhoneCountries,
    isLoadingPhoneCountries,
    getCreationCost,
    getMonthlyCost,
    isCreateDisabledFor,
    showCreateFor,
    showDeleteFor,
    confirmDelete,
    setConfirmDelete,
    isDeleting,
    handleProceedDelete,
    submitContact,
    isSubmittingContact,
    // BYOD connect / disconnect / feature management lives in
    // ``AssistantWorkspaceManager`` now — those hook fields are not
    // destructured here.  The hook still produces them for the
    // workspace modal's own ``useAssistantContactManager`` instance.
  } = useAssistantContactManager({
    assistant,
    isOpen,
    assistantActions,
    onSuccess,
    initialTab: initialTab === 'slack' ? undefined : initialTab,
    userPhoneNumber,
    userWhatsappNumber,
    userDiscordId,
  });

  const {
    register,
    setValue,
    formState: { errors },
    control,
  } = contactFormMethods;

  const isSubmitting = isSubmittingContact;
  const isBusy = isSubmitting || isDeleting;

  const rhfPhoneCountry = useWatch({ control, name: 'phoneCountry' });

  // Slack is a display/routing-only entry — it has no per-assistant contact
  // row, cost, or create/delete flow — so its section manages its own
  // connect/disconnect and never calls the hook's create/delete helpers (which
  // are typed to billable `ContactType`s).
  const slackAvailable = !!assistantActions.slack && !!slackOwner;

  // Channel availability is reported by Orchestra (which probes the comms layer
  // for the underlying provider credentials). A deployment without Twilio
  // configured can't provision those channels, so we hide their sections rather
  // than letting a user reach a CTA that would fail at runtime. Email stays
  // visible (it's BYOD workspace OAuth, gated inside the Workspace modal), and
  // Discord stays visible so users can always install the assistant's bot.
  const { contactPhone, contactWhatsapp } = useFeatures();

  // Tracks which contact type's Create is in flight so only its button spins
  // (the hook exposes a single submitting flag shared across sections).
  const [creatingType, setCreatingType] = React.useState<ContactType | null>(null);

  const handleCreate = async (type: ContactType) => {
    setCreatingType(type);
    try {
      await submitContact(type);
    } finally {
      setCreatingType(null);
    }
  };

  // Deep links (e.g. the info panel's "Add phone") pass an ``initialTab``; scroll
  // that section into view once the sections render rather than selecting a tab.
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!isOpen || !initialTab) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const section = container.querySelector(`[data-contact-section="${initialTab}"]`);
    if (section) {
      requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
    }
  }, [isOpen, initialTab]);

  const handleDialogClose = (open: boolean) => {
    if (!isBusy && !open) {
      onClose();
    }
  };

  const handleInteractOutside = (e: React.MouseEvent) => {
    if (isBusy) {
      e.preventDefault();
    }
  };

  // -------------------------------------------------------------------------
  // Email tab content — display-only. Workspace account configuration lives in
  // ``AssistantWorkspaceManager``; this tab exposes the relevant CTA.
  // -------------------------------------------------------------------------

  const openWorkspace = () => {
    if (!onOpenWorkspaceManager) return;
    // Close ContactManager so the Workspace modal isn't stacked behind it.
    onClose();
    onOpenWorkspaceManager(assistant);
  };

  const renderEmailTab = () => {
    if (assistant.isCoordinator) {
      if (!assistant.email) {
        return (
          <p className="text-body text-muted-foreground">
            T-W1N email is managed automatically and will appear here once configured.
          </p>
        );
      }

      return (
        <div className="space-y-2">
          <ContactReadyMessage badge={<ProviderBadge provider="Platform-managed" />}>
            T-W1N email is configured.
          </ContactReadyMessage>
          <p className="text-caption text-muted-foreground">
            T-W1N email is managed automatically. Messages to this shared address are routed by
            verified sender identity.
          </p>
        </div>
      );
    }

    if (assistant.email) {
      return (
        <div className="space-y-3">
          <ContactReadyMessage
            badge={assistant.emailProvider && <ProviderBadge provider={assistant.emailProvider} />}
          >
            Email is connected.
          </ContactReadyMessage>
          {canWrite && onOpenWorkspaceManager && (
            <Button variant="outline" size="sm" onClick={openWorkspace}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Configure
            </Button>
          )}
        </div>
      );
    }

    if (!canWrite) {
      return <p className="text-body text-muted-foreground">No email configured.</p>;
    }

    return (
      <div className="space-y-3">
        <p className="text-body text-muted-foreground">No email connected.</p>
        {onOpenWorkspaceManager && (
          <Button variant="outline" size="sm" onClick={openWorkspace}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Configure
          </Button>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Per-section create / delete actions
  // -------------------------------------------------------------------------

  // Slack manages its own connect/disconnect inline, and email provisioning is
  // BYOD-only (handled by the Workspace modal), so those types render no action
  // here. Phone/WhatsApp/Discord expose Create (with cost) or Delete inline.
  const renderContactActions = (type: ContactType) => {
    if (!canWrite) return null;

    if (showDeleteFor(type)) {
      return (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(type)}
            disabled={isBusy}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      );
    }

    if (showCreateFor(type)) {
      const creationCost = getCreationCost(type);
      const monthlyCost = getMonthlyCost(type);
      return (
        <div className="flex items-center justify-between gap-3">
          <CostDisplay creationCost={creationCost} monthlyCost={monthlyCost} />
          <BillableActionGuard
            creditsRequired={
              creationCost !== null && creationCost > 0
                ? creationCost
                : monthlyCost !== null && monthlyCost > 0
                  ? monthlyCost
                  : 0
            }
            onAddPaymentMethod={onAddPaymentMethod}
            tooltipMessage={
              monthlyCost !== null && monthlyCost > 0
                ? `This will deduct ${monthlyCost.toFixed(2)} credits/month from your wallet.`
                : undefined
            }
          >
            <Button onClick={() => void handleCreate(type)} disabled={isCreateDisabledFor(type)}>
              {creatingType === type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </BillableActionGuard>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent onInteractOutside={handleInteractOutside as any}>
        <FormProvider {...contactFormMethods}>
          <DialogHeader>
            <DialogTitle className="text-title">Update Contact</DialogTitle>
            <DialogDescription className="text-subtitle">
              {assistant.isCoordinator
                ? 'T-W1N contacts are platform-managed: Contact details are automatically provisioned and incoming messages are routed to T-W1N using your verified sender identity — there is nothing to create or configure.'
                : `Manage contact details for ${assistant.firstName}.`}
            </DialogDescription>
          </DialogHeader>

          {confirmDelete ? (
            <>
              <div className="py-8 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <h3 className="text-h2 mt-4">Are you sure?</h3>
                <p className="text-body-muted mx-auto mt-2 max-w-sm">
                  Deleting the {confirmDelete} contact method is irreversible. You can add a new one
                  again at any time.
                </p>
              </div>
              <DialogFooter>
                <div className="flex w-full items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDelete(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleProceedDelete} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Proceed
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : (
            <div
              ref={scrollContainerRef}
              className="-mr-2 max-h-[60vh] space-y-6 overflow-y-auto pr-2 pt-2"
            >
              <ContactSection
                type="email"
                icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                label="Email"
              >
                {renderEmailTab()}
                {renderContactActions('email')}
              </ContactSection>

              {contactPhone && (
                <ContactSection
                  type="phone"
                  icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                  label="Phone"
                >
                  <PhoneTabContent
                    assistant={assistant}
                    canWrite={canWrite}
                    rhfPhoneCountry={rhfPhoneCountry}
                    setValue={setValue}
                    register={register}
                    errors={errors}
                    isSubmitting={isSubmitting}
                    isLoadingPhoneCountries={isLoadingPhoneCountries}
                    availablePhoneCountries={availablePhoneCountries}
                    userPhoneNumber={userPhoneNumber}
                    onOpenUserSettings={onOpenUserSettings}
                  />
                  {renderContactActions('phone')}
                </ContactSection>
              )}

              {contactWhatsapp && (
                <ContactSection
                  type="whatsapp"
                  icon={<WhatsApp sx={{ fontSize: '18px' }} className="text-muted-foreground" />}
                  label="WhatsApp"
                >
                  <WhatsAppTabContent
                    assistant={assistant}
                    canWrite={canWrite}
                    userWhatsappNumber={userWhatsappNumber}
                    onOpenUserSettings={onOpenUserSettings}
                  />
                  {renderContactActions('whatsapp')}
                </ContactSection>
              )}

              <ContactSection
                type="discord"
                icon={<FaDiscord className="h-4 w-4 text-muted-foreground" />}
                label="Discord"
              >
                <DiscordTabContent
                  assistant={assistant}
                  canWrite={canWrite}
                  userDiscordId={userDiscordId}
                  onOpenUserSettings={onOpenUserSettings}
                />
                {renderContactActions('discord')}
              </ContactSection>

              {slackAvailable && slackOwner && assistantActions.slack && (
                <ContactSection
                  type="slack"
                  icon={<Slack className="h-4 w-4 text-muted-foreground" />}
                  label="Slack"
                >
                  <SlackTabContent
                    assistant={assistant}
                    owner={slackOwner}
                    canManage={slackCanManageInstall}
                    initialInstall={slackInitialInstall}
                    actions={assistantActions.slack}
                  />
                </ContactSection>
              )}
            </div>
          )}
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Cost display helper
// ---------------------------------------------------------------------------

const CostDisplay: React.FC<{
  creationCost: number | null;
  monthlyCost: number | null;
}> = ({ creationCost, monthlyCost }) => (
  <div className="text-body text-muted-foreground">
    {creationCost !== null && creationCost > 0 ? (
      <p>
        Setup:{' '}
        <span className="text-strong text-foreground">{creationCost.toFixed(2)} Credits</span>
      </p>
    ) : creationCost === null ? (
      <p>
        <span className="text-strong text-foreground">Setup fee applies</span>
      </p>
    ) : null}
    {monthlyCost !== null && monthlyCost > 0 ? (
      <p>
        Monthly:{' '}
        <span className="text-strong text-foreground">{monthlyCost.toFixed(2)} Credits/mo</span>
      </p>
    ) : monthlyCost === null ? (
      <p>
        <span className="text-strong text-foreground">Monthly fee applies</span>
      </p>
    ) : null}
  </div>
);

// ---------------------------------------------------------------------------
// Phone / WhatsApp / Discord tab content (extracted for readability)
// ---------------------------------------------------------------------------

const PhoneTabContent: React.FC<{
  assistant: Assistant;
  canWrite: boolean;
  rhfPhoneCountry: string;
  setValue: any;
  register: any;
  errors: any;
  isSubmitting: boolean;
  isLoadingPhoneCountries: boolean;
  availablePhoneCountries: { code: string; name: string; flag: string }[];
  userPhoneNumber?: string | null;
  onOpenUserSettings?: (tab?: string) => void;
}> = ({
  assistant,
  canWrite,
  rhfPhoneCountry,
  setValue,
  register,
  errors,
  isSubmitting,
  isLoadingPhoneCountries,
  availablePhoneCountries,
  userPhoneNumber,
  onOpenUserSettings,
}) => {
  if (assistant.isCoordinator) {
    if (!assistant.phone) {
      return (
        <p className="text-body text-muted-foreground">
          T-W1N phone is managed automatically and will appear here once configured.
        </p>
      );
    }

    return (
      <div className="space-y-2">
        <ContactReadyMessage badge={<ProviderBadge provider="Platform-managed" />}>
          T-W1N phone is configured.
        </ContactReadyMessage>
        <p className="text-caption text-muted-foreground">
          T-W1N phone is managed automatically. SMS messages and calls to this shared number are
          routed by verified sender identity.
        </p>
      </div>
    );
  }

  if (assistant.phone) {
    return <ContactReadyMessage>Assistant phone contact is active.</ContactReadyMessage>;
  }
  if (!canWrite) {
    return <p className="text-body text-muted-foreground">No phone number configured.</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-row items-center gap-2 pb-1">
          <Label htmlFor="phoneCountry">Assistant Phone Country</Label>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoSquareButton />
              </TooltipTrigger>
              <TooltipContent side="right" align="end" className="text-caption max-w-xs">
                <p>{"The country where your assistant's phone number will be based."}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          value={rhfPhoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE}
          onValueChange={(value) => {
            setValue('phoneCountry', value, { shouldDirty: true, shouldValidate: true });
          }}
          disabled={isSubmitting || isLoadingPhoneCountries}
        >
          <SelectTrigger
            id="phoneCountry"
            {...register('phoneCountry', { required: 'Country is required.' })}
          >
            <SelectValue
              placeholder={isLoadingPhoneCountries ? 'Loading countries...' : 'Select country...'}
            />
          </SelectTrigger>
          <SelectContent>
            {isLoadingPhoneCountries ? (
              <SelectItem value="loading" disabled>
                Loading...
              </SelectItem>
            ) : (
              availablePhoneCountries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <span className="mr-2">{getCountryFlag(country.code)}</span> {country.name} (
                  {country.code})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors.phoneCountry && (
          <p className="text-body text-strong mt-1 text-destructive">
            {errors.phoneCountry.message}
          </p>
        )}
      </div>
      {!userPhoneNumber && (
        <ProfileContactRequiredNotice
          message="No phone number set in your profile."
          linkLabel="Add your phone number"
          suffix="to enable phone interactions with your assistant."
          onOpenUserSettings={onOpenUserSettings}
        />
      )}
    </div>
  );
};

const WhatsAppTabContent: React.FC<{
  assistant: Assistant;
  canWrite: boolean;
  userWhatsappNumber?: string | null;
  onOpenUserSettings?: (tab?: string) => void;
}> = ({ assistant, canWrite, userWhatsappNumber, onOpenUserSettings }) => {
  if (assistant.assistantWhatsappNumber) {
    return (
      <div className="space-y-2">
        <ContactReadyMessage>
          {assistant.isCoordinator
            ? 'T-W1N WhatsApp is configured.'
            : 'Assistant WhatsApp contact is active.'}
        </ContactReadyMessage>
        <p className="text-caption text-muted-foreground">
          {assistant.isCoordinator
            ? 'T-W1N WhatsApp is managed automatically. Messages to this shared number are routed by verified sender identity.'
            : 'Send a message first — your assistant can only call you on WhatsApp after you start a conversation.'}
        </p>
      </div>
    );
  }
  if (assistant.isCoordinator) {
    return (
      <p className="text-body text-muted-foreground">
        T-W1N WhatsApp is managed automatically and will appear here once configured.
      </p>
    );
  }
  if (!canWrite) {
    return <p className="text-body text-muted-foreground">No WhatsApp configured.</p>;
  }
  return (
    <div className="space-y-4">
      {userWhatsappNumber ? (
        <p className="text-body text-muted-foreground">
          Create a WhatsApp contact to enable WhatsApp messaging with your assistant.
        </p>
      ) : (
        <ProfileContactRequiredNotice
          message="No WhatsApp number set in your profile."
          linkLabel="Add your WhatsApp number"
          suffix="to enable WhatsApp messaging with your assistant."
          onOpenUserSettings={onOpenUserSettings}
        />
      )}
    </div>
  );
};

const DiscordTabContent: React.FC<{
  assistant: Assistant;
  canWrite: boolean;
  userDiscordId?: string | null;
  onOpenUserSettings?: (tab?: string) => void;
}> = ({ assistant, canWrite, userDiscordId, onOpenUserSettings }) => {
  if (assistant.assistantDiscordBotId) {
    const installUrl = `https://discord.com/oauth2/authorize?client_id=${assistant.assistantDiscordBotId}&scope=bot&permissions=309237763072`;
    return (
      <div className="space-y-3">
        <ContactReadyMessage>Discord bot is configured.</ContactReadyMessage>
        {canWrite && (
          <Button asChild className="gap-2">
            <a href={installUrl} target="_blank" rel="noopener noreferrer">
              <FaDiscord className="h-4 w-4" />
              Add to your server
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </Button>
        )}
        <p className="text-caption text-muted-foreground">
          Install the bot into your Discord server, or join the{' '}
          <a
            href="https://discord.gg/kRtBDmBA"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary-tint-80"
          >
            Unify server
          </a>{' '}
          to start talking to your assistant.
        </p>
      </div>
    );
  }
  if (!canWrite) {
    return <p className="text-body text-muted-foreground">No Discord configured.</p>;
  }
  return (
    <div className="space-y-4">
      {userDiscordId ? (
        <p className="text-body text-muted-foreground">
          Create a Discord bot to enable Discord messaging with your assistant.
        </p>
      ) : (
        <ProfileContactRequiredNotice
          message="No Discord ID set in your profile."
          linkLabel="Link your Discord account"
          suffix="to enable Discord messaging with your assistant."
          onOpenUserSettings={onOpenUserSettings}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Slack tab content
// ---------------------------------------------------------------------------

/**
 * Slack is connected once per workspace (per org, or per personal
 * account) and shared by every assistant in that scope — so this tab
 * reflects the shared install rather than a per-assistant contact.
 * Once connected, this assistant is reachable in Slack via
 * ``@<app> <token>``, where ``<token>`` is its id, first name, or full
 * name (the id always disambiguates).
 */
const SlackTabContent: React.FC<{
  assistant: Assistant;
  owner: SlackInstallOwner;
  canManage: boolean;
  initialInstall: SlackInstall | null;
  actions: NonNullable<AssistantActions['slack']>;
}> = ({ assistant, owner, canManage, initialInstall, actions }) => {
  const { install, isConnecting, isDisconnecting, connect, disconnect } = useSlackIntegration({
    owner,
    initialInstall,
    actions,
    redirectAfter: '/assistants',
  });

  const ownerNoun = owner.kind === 'org' ? 'organization' : 'account';
  const fullName = `${assistant.firstName} ${assistant.surname}`.trim();

  if (!install) {
    if (!canManage) {
      return (
        <p className="text-body text-muted-foreground">
          No Slack workspace is connected for this {ownerNoun} yet. Ask your{' '}
          {owner.kind === 'org' ? 'organization owner or admin' : 'account owner'} to connect Slack.
        </p>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-body text-muted-foreground">
          Connect a Slack workspace so this {ownerNoun}&apos;s assistants can chat in DMs and
          channels. You only connect once — every assistant in this {ownerNoun} becomes reachable.
        </p>
        <Button onClick={connect} disabled={isConnecting} className="gap-2">
          <Slack className="h-4 w-4" />
          {isConnecting ? 'Redirecting…' : 'Add to Slack'}
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ContactReadyMessage>
        Connected to <strong>{install.slackTeamName ?? install.slackTeamId}</strong>.
      </ContactReadyMessage>

      <div className="space-y-3">
        <p className="text-caption text-muted-foreground">
          Address this assistant in Slack by mentioning the app with{' '}
          <span className="font-medium text-foreground">{fullName || assistant.firstName}</span> or
          ID <span className="font-medium text-foreground">{assistant.agentId}</span>.
        </p>
      </div>

      {install.revoked && (
        <p className="text-caption text-destructive" data-testid="slack-install-revoked-notice">
          This install has been revoked. Re-connect to restore Slack messaging.
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={connect}
            disabled={isConnecting}
            className="gap-2"
          >
            <Slack className="h-3.5 w-3.5" />
            Re-install
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDisconnecting}
                className="gap-2"
                data-testid="slack-disconnect-button"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Slack workspace</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the Slack install for{' '}
                  <strong>{install.slackTeamName ?? install.slackTeamId}</strong> from this{' '}
                  {ownerNoun}. Inbound messages will stop reaching <strong>all assistants</strong>{' '}
                  in this {ownerNoun}, and channel bindings and thread routes will be dropped. You
                  can re-connect at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={disconnect}
                  className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
                >
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {!canManage && (
        <p className="text-caption text-muted-foreground">
          Only an {owner.kind === 'org' ? 'organization owner or admin' : 'account owner'} can
          change the Slack workspace connection.
        </p>
      )}
    </div>
  );
};
