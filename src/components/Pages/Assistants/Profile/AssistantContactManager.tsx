'use client';

import * as React from 'react';
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
  Info,
  Copy,
  Check,
  Link2,
  Unlink,
} from 'lucide-react';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ContactType, EmailProvider, OAuthProvider } from '@/types/assistants/contact';
import { FormProvider, useWatch } from 'react-hook-form';
import { EMAIL_DOMAINS, FALLBACK_DEFAULT_COUNTRY_CODE } from '@/constants/assistants/settings';
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
import { useAssistantContactManager } from '@/hooks/Assistants/useAssistantContactManager';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import { Badge } from '@/components/UI/badge';
import { Checkbox } from '@/components/UI/checkbox';
import { cn } from '@/lib/utils';

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
  /** User's phone number from their profile */
  userPhoneNumber?: string | null;
  /** User's WhatsApp number from their profile */
  userWhatsappNumber?: string | null;
  /** User's Discord ID from their profile */
  userDiscordId?: string | null;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

const DisplayContactField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
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
                  <Check className="h-4 w-4 text-green-500" />
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
const PROVIDER_LABELS: Record<string, string> = {
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

const ProviderBadge: React.FC<{ provider: string }> = ({ provider }) => (
  <Badge variant="secondary" className="ml-2 text-xs font-normal">
    {PROVIDER_LABELS[provider] ?? provider}
  </Badge>
);

// ---------------------------------------------------------------------------
// Email provider picker cards (for platform provisioning)
// ---------------------------------------------------------------------------

const EmailProviderCard: React.FC<{
  provider: EmailProvider;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}> = ({ provider, isSelected, onSelect, disabled }) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    className={cn(
      'flex flex-1 flex-col items-center rounded-lg border p-3 transition-colors',
      isSelected
        ? 'bg-primary/5 border-primary ring-1 ring-primary'
        : 'hover:border-muted-foreground/50 border-border',
      disabled && 'cursor-not-allowed opacity-50'
    )}
  >
    <span className="text-body text-strong">
      {provider === 'google_workspace' ? 'Gmail' : 'Outlook'}
    </span>
    <span className="text-caption text-muted-foreground">{EMAIL_DOMAINS[provider]}</span>
  </button>
);

// ---------------------------------------------------------------------------
// BYOD provider picker cards
// ---------------------------------------------------------------------------

const ByodProviderCard: React.FC<{
  provider: OAuthProvider;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}> = ({ provider, isSelected, onSelect, disabled }) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    className={cn(
      'flex flex-1 flex-col items-center rounded-lg border p-3 transition-colors',
      isSelected
        ? 'bg-primary/5 border-primary ring-1 ring-primary'
        : 'hover:border-muted-foreground/50 border-border',
      disabled && 'cursor-not-allowed opacity-50'
    )}
  >
    <span className="text-body text-strong">
      {provider === 'google' ? 'Google' : 'Microsoft 365'}
    </span>
    <span className="text-caption text-muted-foreground">
      {provider === 'google' ? 'Gmail, Calendar, Drive' : 'Outlook, Teams, Calendar'}
    </span>
  </button>
);

// ---------------------------------------------------------------------------
// Feature checklist
// ---------------------------------------------------------------------------

const FeatureChecklist: React.FC<{
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
  userPhoneNumber,
  userWhatsappNumber,
  userDiscordId,
}: AssistantContactManagerProps) {
  const {
    // Self-contained form methods from the hook
    contactFormMethods,
    activeTab,
    setActiveTab,
    emailLocalPart,
    handleLocalPartChange,
    allAssistantEmails,
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
    // Email provider (platform)
    emailProvider,
    setEmailProvider,
    activeEmailDomain,
    // BYOD
    byodProvider,
    setByodProvider,
    selectedFeatures,
    toggleFeature,
    availableFeaturesForByod,
    requiredFeaturesForByod,
    grantedFeatures,
    isLoadingFeatures,
    hasFeaturesChanged,
    connectAccount,
    updateFeatures,
    disconnectAccount,
    isConnecting,
    isDisconnecting,
    confirmDisconnect,
    setConfirmDisconnect,
    isByodEmail,
    isPlatformEmail,
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
    getValues,
    control,
  } = contactFormMethods;

  const isSubmitting = isSubmittingContact;
  const isBusy = isSubmitting || isDeleting || isConnecting || isDisconnecting;

  const rhfPhoneCountry = useWatch({ control, name: 'phoneCountry' });

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
  // Email tab content (four states)
  // -------------------------------------------------------------------------

  const renderEmailTab = () => {
    // State 4: Read-only user
    if (!canWrite) {
      if (assistant.email) {
        return (
          <div className="space-y-2">
            <DisplayContactField label="Email Address" value={assistant.email} />
            {assistant.emailProvider && <ProviderBadge provider={assistant.emailProvider} />}
          </div>
        );
      }
      return <p className="text-body text-muted-foreground">No email configured.</p>;
    }

    // State 2: Platform email exists
    if (isPlatformEmail) {
      return (
        <div className="space-y-3">
          <div className="flex items-center">
            <Label>Email Address</Label>
            {assistant.emailProvider && <ProviderBadge provider={assistant.emailProvider} />}
          </div>
          <DisplayContactField label="" value={assistant.email!} />
          <p className="text-caption text-muted-foreground">
            Platform-managed email. Delete it to connect your own account instead.
          </p>
        </div>
      );
    }

    // State 3: BYOD email connected
    if (isByodEmail) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>Connected Email</Label>
            <Badge variant="outline" className="text-xs">
              <Link2 className="mr-1 h-3 w-3" />
              {PROVIDER_LABELS[grantedFeatures?.provider ?? assistant.emailProvider ?? ''] ??
                'Connected'}
            </Badge>
          </div>
          <DisplayContactField label="" value={assistant.email!} />

          {/* Feature list */}
          {isLoadingFeatures ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-caption">Loading features...</span>
            </div>
          ) : availableFeaturesForByod.length > 0 ? (
            <div className="space-y-2">
              <Label>Features</Label>
              <FeatureChecklist
                features={availableFeaturesForByod}
                selected={selectedFeatures}
                required={requiredFeaturesForByod}
                onToggle={toggleFeature}
              />
            </div>
          ) : null}
        </div>
      );
    }

    // State 1: No email — provision or connect
    return (
      <div className="space-y-6">
        {/* Sub-section A: Provision a platform email */}
        <div className="space-y-3">
          <Label className="text-strong">Provision a platform email</Label>
          <div className="flex gap-2">
            <EmailProviderCard
              provider="google_workspace"
              isSelected={emailProvider === 'google_workspace'}
              onSelect={() => setEmailProvider('google_workspace')}
              disabled={isSubmitting}
            />
            <EmailProviderCard
              provider="microsoft_365"
              isSelected={emailProvider === 'microsoft_365'}
              onSelect={() => setEmailProvider('microsoft_365')}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex items-center rounded-md">
            <Input
              id="email_local_part"
              type="text"
              value={emailLocalPart}
              onChange={handleLocalPartChange}
              placeholder="new-assistant"
              className="h-9 max-w-[250px] flex-1 rounded-r-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isSubmitting}
            />
            <span className="text-caption flex h-9 select-none items-center rounded-r-md border-l border-input bg-muted px-3 py-2 text-muted-foreground">
              {activeEmailDomain}
            </span>
          </div>
          <input
            type="hidden"
            {...register('email', {
              validate: (value) => {
                if (getValues('isEmailAdded')) {
                  if (!value || !value.endsWith(activeEmailDomain) || value.startsWith('@'))
                    return 'A valid email is required.';
                  if (allAssistantEmails.includes(value) && value !== assistant.email)
                    return 'This email is already taken.';
                }
                return true;
              },
            })}
          />
          {errors.email && (
            <p className="text-body text-strong mt-1 text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-caption text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Sub-section B: Connect your own account */}
        <div className="space-y-3">
          <Label className="text-strong">Connect your own account</Label>
          <div className="flex gap-2">
            <ByodProviderCard
              provider="google"
              isSelected={byodProvider === 'google'}
              onSelect={() => setByodProvider(byodProvider === 'google' ? null : 'google')}
              disabled={isConnecting}
            />
            <ByodProviderCard
              provider="microsoft"
              isSelected={byodProvider === 'microsoft'}
              onSelect={() => setByodProvider(byodProvider === 'microsoft' ? null : 'microsoft')}
              disabled={isConnecting}
            />
          </div>

          {byodProvider && (
            <div className="space-y-3 pt-1">
              <Label className="text-caption text-muted-foreground">
                Select features to grant access to:
              </Label>
              <FeatureChecklist
                features={availableFeaturesForByod}
                selected={selectedFeatures}
                required={requiredFeaturesForByod}
                onToggle={toggleFeature}
                disabled={isConnecting}
              />
              <Button onClick={connectAccount} disabled={isConnecting || !byodProvider}>
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Footer logic
  // -------------------------------------------------------------------------

  const renderFooter = () => {
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

    // Confirm disconnect (BYOD)
    if (confirmDisconnect) {
      return (
        <div className="flex w-full items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmDisconnect(false)}
            disabled={isDisconnecting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={disconnectAccount} disabled={isDisconnecting}>
            {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Disconnect
          </Button>
        </div>
      );
    }

    // BYOD connected state — disconnect + optional update features
    if (activeTab === 'email' && isByodEmail && canWrite) {
      return (
        <div className="flex w-full items-center justify-between">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDisconnect(true)}
            disabled={isBusy}
          >
            <Unlink className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
          {hasFeaturesChanged && (
            <Button onClick={updateFeatures} disabled={isConnecting}>
              {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Features
            </Button>
          )}
        </div>
      );
    }

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
                  ? `This will add $${monthlyCost.toFixed(2)}/month to your bill.`
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

    // Create button for email (platform provisioning) — only in State 1 when no BYOD provider is selected
    if (showCreateButton && canWrite && activeTab === 'email' && !byodProvider) {
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
                  ? `This will add $${monthlyCost.toFixed(2)}/month to your bill.`
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
          ) : confirmDisconnect ? (
            <div className="py-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="text-h2 mt-4">Disconnect account?</h3>
              <p className="text-body-muted mx-auto mt-2 max-w-sm">
                This will revoke access and remove the connected email. Your assistant will no
                longer be able to send or receive emails via this account.
              </p>
            </div>
          ) : (
            <div className="w-full pt-4">
              <Select
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as ContactType)}
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
                </SelectContent>
              </Select>

              <div className="max-h-[60vh] overflow-y-auto py-4 pt-8">
                {activeTab === 'email' && renderEmailTab()}

                {activeTab === 'phone' && (
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

                {activeTab === 'whatsapp' && (
                  <WhatsAppTabContent
                    assistant={assistant}
                    canWrite={canWrite}
                    userWhatsappNumber={userWhatsappNumber}
                  />
                )}

                {activeTab === 'discord' && (
                  <DiscordTabContent
                    assistant={assistant}
                    canWrite={canWrite}
                    userDiscordId={userDiscordId}
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
                <Info className="h-4 w-4 cursor-help text-muted-foreground" />
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
                <Info className="h-4 w-4 cursor-help text-muted-foreground" />
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
            <CheckCircle2 className="h-5 w-5 text-green-500" />
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
                <Info className="h-4 w-4 cursor-help text-muted-foreground" />
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
            <CheckCircle2 className="h-5 w-5 text-green-500" />
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
              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
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
          <CheckCircle2 className="h-5 w-5 text-green-500" />
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
