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
  initialTab?: ContactType;
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

// ---------------------------------------------------------------------------
// BYOD provider picker cards
// ---------------------------------------------------------------------------

export const ByodProviderCard: React.FC<{
  provider: OAuthProvider;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}> = ({ provider, isSelected, onSelect, disabled }) => {
  const isGoogle = provider === 'google';
  const title = isGoogle ? 'Google Workspace' : 'Microsoft 365';
  const subtitle = isGoogle ? 'Gmail, Calendar, Drive' : 'Outlook, Teams, Calendar';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 text-center shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--role-green-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected
          ? 'border-[color:var(--role-green-deep)] bg-[color:var(--status-success-bg)] ring-1 ring-[color:var(--role-green-deep)]'
          : 'border-border bg-card hover:border-[color:var(--role-green-deep)] hover:bg-[color:var(--status-success-bg)]',
        disabled && 'cursor-not-allowed opacity-50'
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
}> = ({ features, selected, required, onToggle, disabled }) => (
  <div className="space-y-2">
    {features.map((feature) => {
      const isRequired = required.includes(feature);
      const isChecked = selected.includes(feature);
      return (
        <label
          key={feature}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors',
            isChecked ? 'border-primary/30 bg-primary/5' : 'border-border',
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
}: AssistantContactManagerProps) {
  const {
    // Self-contained form methods from the hook
    contactFormMethods,
    activeTab,
    setActiveTab,
    availablePhoneCountries,
    isLoadingPhoneCountries,
    creationCost,
    monthlyCost,
    isCreateButtonDisabled,
    showCreateButton,
    showDeleteButton,
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
    initialTab,
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

  // Slack is a display/routing-only entry — it has no per-assistant
  // contact row, cost, or create/delete flow — so it lives outside the
  // contact hook's `activeTab` (which is typed to billable `ContactType`s).
  // We overlay a widened local tab and forward only real contact types
  // back to the hook so its footer/cost logic stays consistent.
  const slackAvailable = !!assistantActions.slack && !!slackOwner;
  const [selectedTab, setSelectedTab] = React.useState<ContactManagerTab>(initialTab ?? activeTab);
  React.useEffect(() => {
    if (isOpen && initialTab) setSelectedTab(initialTab);
  }, [isOpen, initialTab]);
  const handleTabChange = (value: ContactManagerTab) => {
    setSelectedTab(value);
    if (value !== 'slack') setActiveTab(value);
  };

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
  // Email tab content — display-only.  Connect / disconnect / feature
  // configuration moved to the Workspace modal (``AssistantWorkspaceManager``);
  // this tab now just shows the email address (if connected) plus a
  // CTA that opens that modal.
  // -------------------------------------------------------------------------

  const openWorkspace = () => {
    if (!onOpenWorkspaceManager) return;
    // Close ContactManager so the Workspace modal isn't stacked behind it.
    onClose();
    onOpenWorkspaceManager(assistant);
  };

  const renderEmailTab = () => {
    if (assistant.email) {
      return (
        <div className="space-y-3">
          <div className="flex items-center">
            <Label>Email Address</Label>
            {assistant.emailProvider && <ProviderBadge provider={assistant.emailProvider} />}
          </div>
          <DisplayContactField label="" value={assistant.email} />
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
  // Footer logic
  // -------------------------------------------------------------------------

  const renderFooter = () => {
    // Slack is display/routing-only: connect/disconnect live inside the
    // Slack tab itself, so there's no shared dialog footer for it.
    if (selectedTab === 'slack') return null;

    // Confirm delete (platform contact)
    if (confirmDelete) {
      return (
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleProceedDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Proceed
          </Button>
        </div>
      );
    }

    // BYOD confirm-disconnect / connect / update-features actions live
    // in the Workspace modal now — the Email tab is display-only.

    // Delete button for platform email or other contacts
    if (showDeleteButton && canWrite) {
      return (
        <div className="flex w-full items-center justify-end">
          <Button
            variant="destructive"
            onClick={() => setConfirmDelete(activeTab as any)}
            disabled={isBusy}
          >
            Delete
          </Button>
        </div>
      );
    }

    // Create button (platform provisioning for non-BYOD email + other contact types)
    if (showCreateButton && canWrite && activeTab !== 'email') {
      return (
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between">
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
              <Button onClick={submitContact} disabled={isCreateButtonDisabled || isBusy}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </BillableActionGuard>
          </div>
        </div>
      );
    }

    // Email tab no longer has a Create footer — platform-issued mailbox
    // provisioning is hidden, and BYOD uses the inline Connect button.
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent onInteractOutside={handleInteractOutside as any}>
        <FormProvider {...contactFormMethods}>
          <DialogHeader>
            <DialogTitle className="text-title">Update Contact</DialogTitle>
            <DialogDescription className="text-subtitle">
              Manage contact details for {assistant.firstName}.
            </DialogDescription>
          </DialogHeader>

          {confirmDelete ? (
            <div className="py-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="text-h2 mt-4">Are you sure?</h3>
              <p className="text-body-muted mx-auto mt-2 max-w-sm">
                Deleting the {confirmDelete} contact method is irreversible. You can add a new one
                again at any time.
              </p>
            </div>
          ) : (
            <div className="w-full pt-4">
              <Select
                value={selectedTab}
                onValueChange={(value) => handleTabChange(value as ContactManagerTab)}
              >
                <SelectTrigger data-testid="contact-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <span className="flex items-center">
                      <Mail className="mr-2 h-4 w-4" /> Email
                    </span>
                  </SelectItem>
                  <SelectItem value="phone">
                    <span className="flex items-center">
                      <Phone className="mr-2 h-4 w-4" /> Phone
                    </span>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <span className="flex items-center">
                      <WhatsApp sx={{ fontSize: '18px', marginRight: '8px' }} /> WhatsApp
                    </span>
                  </SelectItem>
                  <SelectItem value="discord">
                    <span className="flex items-center">
                      <FaDiscord className="mr-2 h-4 w-4" /> Discord
                    </span>
                  </SelectItem>
                  {slackAvailable && (
                    <SelectItem value="slack">
                      <span className="flex items-center">
                        <Slack className="mr-2 h-4 w-4" /> Slack
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <div className="max-h-[60vh] overflow-y-auto py-4 pt-8">
                {selectedTab === 'email' && renderEmailTab()}

                {selectedTab === 'phone' && (
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
                  />
                )}

                {selectedTab === 'whatsapp' && (
                  <WhatsAppTabContent
                    assistant={assistant}
                    canWrite={canWrite}
                    userWhatsappNumber={userWhatsappNumber}
                  />
                )}

                {selectedTab === 'discord' && (
                  <DiscordTabContent
                    assistant={assistant}
                    canWrite={canWrite}
                    userDiscordId={userDiscordId}
                  />
                )}

                {selectedTab === 'slack' && slackOwner && assistantActions.slack && (
                  <SlackTabContent
                    assistant={assistant}
                    owner={slackOwner}
                    canManage={slackCanManageInstall}
                    initialInstall={slackInitialInstall}
                    actions={assistantActions.slack}
                  />
                )}
              </div>
            </div>
          )}

          <DialogFooter>{renderFooter()}</DialogFooter>
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
}) => {
  if (assistant.phone) {
    return <DisplayContactField label="Assistant Phone Number" value={assistant.phone} />;
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
      <div>
        <div className="flex flex-row items-center gap-2 pb-1">
          <Label>Your Phone</Label>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoSquareButton />
              </TooltipTrigger>
              <TooltipContent side="right" align="end" className="text-caption max-w-xs">
                <p>
                  {
                    'This is the phone number you will contact the assistant with. Manage it in your profile.'
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {userPhoneNumber ? (
          <div className="flex items-center gap-2">
            <Input value={userPhoneNumber} readOnly disabled className="flex-1" />
            <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success)]" />
          </div>
        ) : (
          <div className="border-muted-foreground/40 rounded-md border border-dashed p-3">
            <p className="text-body text-muted-foreground">
              No phone number set in your profile.{' '}
              <a
                href="/account?tab=contact-info"
                className="hover:text-primary/80 text-primary underline"
              >
                Add your phone number
              </a>{' '}
              to enable phone interactions with your assistant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const WhatsAppTabContent: React.FC<{
  assistant: Assistant;
  canWrite: boolean;
  userWhatsappNumber?: string | null;
}> = ({ assistant, canWrite, userWhatsappNumber }) => {
  if (assistant.assistantWhatsappNumber) {
    return (
      <div className="space-y-2">
        <DisplayContactField
          label="Assistant WhatsApp Number"
          value={assistant.assistantWhatsappNumber}
        />
        <p className="text-caption text-muted-foreground">
          Send a message first — your assistant can only call you on WhatsApp after you start a
          conversation.
        </p>
      </div>
    );
  }
  if (!canWrite) {
    return <p className="text-body text-muted-foreground">No WhatsApp configured.</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-row items-center gap-2 pb-1">
          <Label>Your WhatsApp</Label>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoSquareButton />
              </TooltipTrigger>
              <TooltipContent side="right" align="end" className="text-caption max-w-xs">
                <p>
                  The WhatsApp number you will use to message your assistant. Manage it in your
                  profile.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {userWhatsappNumber ? (
          <div className="flex items-center gap-2">
            <Input value={userWhatsappNumber} readOnly disabled className="flex-1" />
            <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success)]" />
          </div>
        ) : (
          <div className="border-muted-foreground/40 rounded-md border border-dashed p-3">
            <p className="text-body text-muted-foreground">
              No WhatsApp number set in your profile.{' '}
              <a
                href="/account?tab=contact-info"
                className="hover:text-primary/80 text-primary underline"
              >
                Add your WhatsApp number
              </a>{' '}
              to enable WhatsApp messaging with your assistant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const DiscordTabContent: React.FC<{
  assistant: Assistant;
  canWrite: boolean;
  userDiscordId?: string | null;
}> = ({ assistant, canWrite, userDiscordId }) => {
  if (assistant.assistantDiscordBotId) {
    return (
      <div className="space-y-2">
        <DisplayContactField label="Discord Bot ID" value={assistant.assistantDiscordBotId} />
        <p className="text-caption text-muted-foreground">
          Join the{' '}
          <a
            href="https://discord.gg/kRtBDmBA"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary/80 text-primary underline"
          >
            Unify server
          </a>{' '}
          on Discord to start talking to your assistant.
        </p>
      </div>
    );
  }
  if (!canWrite) {
    return <p className="text-body text-muted-foreground">No Discord configured.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center gap-2 pb-1">
        <Label>Your Discord</Label>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoSquareButton />
            </TooltipTrigger>
            <TooltipContent side="right" align="end" className="text-caption max-w-xs">
              <p>
                Your Discord user ID, used to route DMs from the assigned bot. Manage it in your
                profile.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {userDiscordId ? (
        <div className="flex items-center gap-2">
          <Input value={userDiscordId} readOnly disabled className="flex-1" />
          <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success)]" />
        </div>
      ) : (
        <div className="border-muted-foreground/40 rounded-md border border-dashed p-3">
          <p className="text-body text-muted-foreground">
            No Discord ID set in your profile.{' '}
            <a
              href="/account?tab=contact-info"
              className="hover:text-primary/80 text-primary underline"
            >
              Link your Discord account
            </a>{' '}
            to enable Discord messaging with your assistant.
          </p>
        </div>
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
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success)]" />
        <span className="text-body">
          Connected to <strong>{install.slackTeamName ?? install.slackTeamId}</strong>
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-caption text-muted-foreground">
          Address this assistant in Slack by mentioning the app, then one of:
        </p>
        <DisplayContactField label="By ID (always unique)" value={String(assistant.agentId)} />
        {fullName && <DisplayContactField label="By full name" value={fullName} />}
        {assistant.firstName && (
          <DisplayContactField label="By first name" value={assistant.firstName} />
        )}
      </div>

      {install.revoked && (
        <p className="text-caption text-destructive" data-testid="slack-install-revoked-notice">
          This install has been revoked. Re-connect to restore Slack messaging.
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
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
