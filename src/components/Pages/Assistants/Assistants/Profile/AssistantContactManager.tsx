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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import {
  Loader2,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Send,
  Info,
  Copy,
  Check,
} from 'lucide-react';
import {
  Assistant,
  ContactFormData,
  AssistantActions,
} from '@/types/assistants/assistant';
import { FormProvider, useFormContext, useWatch, useFieldArray } from 'react-hook-form';
import {
  EMAIL_DOMAIN_WITH_AT,
  FALLBACK_DEFAULT_COUNTRY_CODE,
} from '@/constants/assistants/settings';
import { useAccountVerification } from '@/hooks/Assistants/useAccountVerification';
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
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/UI/tooltip';
import { useAssistantContactManager } from '@/hooks/Assistants/useAssistantContactManager';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';

const PhoneVerificationSection: React.FC<{ assistantActions: AssistantActions }> = ({
  assistantActions,
}) => {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
    register,
    clearErrors,
  } = useFormContext<ContactFormData>();

  const phoneFieldNames = React.useMemo(
    () => ({
      identifier: 'userPhone' as const,
      isVerified: 'userPhoneIsVerified' as const,
      isVerifying: 'userPhoneIsVerifying' as const,
      verificationCodeSent: 'userPhoneVerificationCodeSent' as const,
      verificationSentAt: 'userPhoneVerificationSentAt' as const,
      verificationAttempts: 'userPhoneVerificationAttempts' as const,
      verificationError: 'userPhoneVerificationError' as const,
    }),
    []
  );

  const {
    isVerifying,
    isVerificationFlowActive,
    verificationError,
    cooldown,
    verificationInput,
    setVerificationInput,
    handleVerify,
    handleCancelVerification,
    handleSubmitCode,
  } = useAccountVerification<ContactFormData>({
    platform: 'phone',
    fieldNames: phoneFieldNames,
    assistantActions,
  });

  const handleVerifyClick = (isRetry: boolean) => {
    const phoneNumber = getValues('userPhone');
    if (!phoneNumber || phoneNumber.trim() === '') {
      toast.error('Please enter a phone number to verify.');
      return;
    }
    handleVerify(isRetry);
  };

  const isPhoneVerified = useWatch({ control, name: 'userPhoneIsVerified' });
  const phoneValue = useWatch({ control, name: 'userPhone' });
  const isSubmitting = useFormContext<ContactFormData>().formState.isSubmitting;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          id="userPhone"
          type="tel"
          placeholder="e.g., +15551234567"
          className="h-9 flex-1"
          disabled={isVerifying || isSubmitting || isPhoneVerified}
          {...register('userPhone', {
            pattern: {
              value: /^\+[1-9]\d{7,14}$/,
              message:
                'Please enter a valid number (e.g., +15551234567). Make sure there are no extra whitespace.',
            },
            onChange: () => {
              if (getValues('userPhoneIsVerified')) {
                setValue('userPhoneIsVerified', false, { shouldDirty: true });
              }
              if (errors.userPhone) clearErrors('userPhone');
              setValue('isPhoneNumberAdded', true, { shouldDirty: true });
            },
          })}
        />
        {isPhoneVerified ? (
          <Button type="button" variant="default" className="h-9" disabled>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => handleVerifyClick(false)}
            disabled={isVerifying || isSubmitting || !phoneValue}
          >
            {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        )}
      </div>
      {isVerificationFlowActive && (
        <div className="flex items-start gap-3 border-l-2 border-muted pl-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Input
                id="user_phone_verification_code"
                placeholder="Enter verification code..."
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitCode();
                  }
                }}
                className={cn('h-9', verificationError && 'border-destructive')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={handleSubmitCode}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {verificationError && (
              <p className="text-body text-strong mt-1 flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {verificationError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => handleVerifyClick(true)}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
            </Button>
            <Button
              type="button"
              variant="warning"
              size="sm"
              className="h-9"
              onClick={handleCancelVerification}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {errors.userPhone && !isVerificationFlowActive && (
        <p className="text-body text-strong mt-1 text-destructive">{errors.userPhone.message}</p>
      )}
    </div>
  );
};

const WhatsAppVerificationSection: React.FC<{
  assistantActions: AssistantActions;
  cost: number | null;
}> = ({ assistantActions, cost }) => {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
    clearErrors,
  } = useFormContext<ContactFormData>();
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);

  const { fields, append } = useFieldArray({ control, name: 'socialAccounts' });
  const whatsAppAccountIndex = fields.findIndex((field) => field.platform === 'whatsapp');

  React.useEffect(() => {
    if (whatsAppAccountIndex === -1) {
      append({
        platform: 'whatsapp',
        identifier: '',
        isVerified: false,
        isVerifying: false,
        verificationCodeSent: null,
        verificationSentAt: null,
        verificationAttempts: 0,
        verificationError: null,
        isInitial: false,
      });
    }
  }, [whatsAppAccountIndex, append]);

  const account = useWatch({ control, name: `socialAccounts.${whatsAppAccountIndex}` });

  const fieldNames = React.useMemo(
    () => ({
      identifier: `socialAccounts.${whatsAppAccountIndex}.identifier` as const,
      isVerified: `socialAccounts.${whatsAppAccountIndex}.isVerified` as const,
      isVerifying: `socialAccounts.${whatsAppAccountIndex}.isVerifying` as const,
      verificationCodeSent: `socialAccounts.${whatsAppAccountIndex}.verificationCodeSent` as const,
      verificationSentAt: `socialAccounts.${whatsAppAccountIndex}.verificationSentAt` as const,
      verificationAttempts: `socialAccounts.${whatsAppAccountIndex}.verificationAttempts` as const,
      verificationError: `socialAccounts.${whatsAppAccountIndex}.verificationError` as const,
    }),
    [whatsAppAccountIndex]
  );

  const {
    isVerifying,
    isVerificationFlowActive,
    verificationError,
    cooldown,
    verificationInput,
    setVerificationInput,
    handleVerify,
    handleCancelVerification,
    handleSubmitCode,
  } = useAccountVerification<ContactFormData>({
    platform: 'whatsapp',
    fieldNames,
    assistantActions,
  });

  const handleVerifyClick = (isRetry: boolean) => {
    const identifier = getValues(fieldNames.identifier);
    if (!identifier || identifier.trim() === '') {
      toast.error(`Please enter a WhatsApp phone number to verify.`);
      return;
    }
    handleVerify(isRetry);
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(fieldNames.identifier, newValue, { shouldDirty: true });
    if (getValues(fieldNames.isVerified)) {
      setValue(fieldNames.isVerified, false, { shouldDirty: true });
    }
    if (errors.socialAccounts?.[whatsAppAccountIndex]?.identifier) {
      clearErrors(fieldNames.identifier);
    }
  };

  if (whatsAppAccountIndex === -1) {
    return <Loader2 className="h-5 w-5 animate-spin" />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          id={`socialAccounts_${whatsAppAccountIndex}_identifier`}
          placeholder={`Your WhatsApp phone number...`}
          className="h-9 flex-1"
          value={account?.identifier || ''}
          disabled={isVerifying || account?.isVerified}
          onChange={handleIdentifierChange}
        />
        {account?.isVerified ? (
          <Button type="button" variant="default" className="h-9" disabled>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
          </Button>
        ) : (
          <TooltipProvider delayDuration={100}>
            <Tooltip open={!isVerifying ? isTooltipOpen : false} onOpenChange={setIsTooltipOpen}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => handleVerifyClick(false)}
                  disabled={isVerifying || !account?.identifier}
                >
                  {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isVerifying ? 'Verifying...' : 'Verify'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>
                  {cost !== null
                    ? `Costs $${cost.toFixed(2)} credits to pair with your assistant. Verify first to link.`
                    : 'A setup fee applies to pair with your assistant. Verify first to link.'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {isVerificationFlowActive && (
        <div className="flex items-start gap-3 border-l-2 border-muted pl-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Input
                id={`socialAccounts_${whatsAppAccountIndex}_verification_code`}
                placeholder="Enter verification code..."
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitCode();
                  }
                }}
                className={cn('h-9', verificationError && 'border-destructive')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={handleSubmitCode}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {verificationError && (
              <p className="text-body text-strong mt-1 flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {verificationError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => handleVerifyClick(true)}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
            </Button>
            <Button
              type="button"
              variant="warning"
              size="sm"
              className="h-9"
              onClick={handleCancelVerification}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

interface AssistantContactManagerProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  onSuccess: () => void;
  initialTab?: 'email' | 'phone' | 'whatsapp';
  /** Whether the current user can edit contact details */
  canWrite?: boolean;
  /** Callback to open the Stripe payment panel when credits are insufficient */
  onAddPaymentMethod?: () => void;
}

const DisplayContactField: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => {
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

export function AssistantContactManager({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  onSuccess,
  initialTab,
  canWrite = true,
  onAddPaymentMethod,
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
  } = useAssistantContactManager({
    assistant,
    isOpen,
    assistantActions,
    onSuccess,
    initialTab,
  });

  const {
    register,
    setValue,
    formState: { errors },
    getValues,
    control,
  } = contactFormMethods;

  const isSubmitting = isSubmittingContact;

  const rhfPhoneCountry = useWatch({ control, name: 'phoneCountry' });

  const handleDialogClose = (open: boolean) => {
    if (!isSubmitting && !isDeleting) {
      if (!open) {
        onClose();
      }
    }
  };

  const handleInteractOutside = (e: React.MouseEvent) => {
    if (isSubmitting || isDeleting) {
      e.preventDefault();
    }
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
            <Tabs
              value={activeTab}
              className="w-full pt-4"
              onValueChange={(value) => setActiveTab(value as any)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email">
                  <Mail className="mr-2 h-4 w-4" /> Email
                </TabsTrigger>
                <TabsTrigger value="phone">
                  <Phone className="mr-2 h-4 w-4" /> Phone
                </TabsTrigger>
                <TabsTrigger value="whatsapp">
                  <WhatsApp sx={{ fontSize: '18px', marginRight: '8px' }} /> WhatsApp
                </TabsTrigger>
              </TabsList>
              <TabsContent value="email" className="py-4">
                {assistant.email ? (
                  <DisplayContactField
                    label="Email Address"
                    value={assistant.email}
                  />
                ) : canWrite ? (
                  <div className="space-y-2">
                    <Label htmlFor="email_local_part">Email address</Label>
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
                        {EMAIL_DOMAIN_WITH_AT}
                      </span>
                    </div>
                    <input
                      type="hidden"
                      {...register('email', {
                        validate: (value) => {
                          if (getValues('isEmailAdded')) {
                            if (
                              !value ||
                              !value.endsWith(EMAIL_DOMAIN_WITH_AT) ||
                              value.startsWith('@')
                            )
                              return 'A valid email is required.';
                            if (allAssistantEmails.includes(value) && value !== assistant.email)
                              return 'This email is already taken.';
                          }
                          return true;
                        },
                      })}
                    />
                    {errors.email && (
                      <p className="text-body text-strong mt-1 text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-body text-muted-foreground">No email configured.</p>
                )}
              </TabsContent>
              <TabsContent value="phone" className="py-4">
                {assistant.phone ? (
                  <DisplayContactField
                    label="Assistant Phone Number"
                    value={assistant.phone}
                  />
                ) : canWrite ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-row items-center gap-2 pb-1">
                        <Label htmlFor="phoneCountry">Assistant Phone Country</Label>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              align="end"
                              className="text-caption max-w-xs"
                            >
                              <p>
                                {"The country where your assistant's phone number will be based."}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select
                        value={rhfPhoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE}
                        onValueChange={(value) => {
                          setValue('phoneCountry', value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setValue('isPhoneNumberAdded', true, { shouldDirty: true });
                        }}
                        disabled={isSubmitting || isLoadingPhoneCountries}
                      >
                        <SelectTrigger
                          id="phoneCountry"
                          {...register('phoneCountry', {
                            required: getValues('isPhoneNumberAdded')
                              ? 'Country is required.'
                              : false,
                          })}
                        >
                          <SelectValue
                            placeholder={
                              isLoadingPhoneCountries ? 'Loading countries...' : 'Select country...'
                            }
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
                                <span className="mr-2">{getCountryFlag(country.code)}</span>{' '}
                                {country.name} ({country.code})
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
                        <Label htmlFor="userPhone">Your Phone</Label>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              align="end"
                              className="text-caption max-w-xs"
                            >
                              <p>
                                {'This is the phone number you will contact the assistant with.'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <PhoneVerificationSection assistantActions={assistantActions} />
                    </div>
                  </div>
                ) : (
                  <p className="text-body text-muted-foreground">No phone number configured.</p>
                )}
              </TabsContent>
              <TabsContent value="whatsapp" className="py-4">
                {assistant.assistantWhatsappNumber ? (
                  <DisplayContactField
                    label="WhatsApp Number"
                    value={assistant.assistantWhatsappNumber}
                  />
                ) : canWrite ? (
                  <div>
                    <div className="flex flex-row items-center gap-2 pb-1">
                      <Label htmlFor="user_whatsapp">Your WhatsApp Number</Label>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            align="end"
                            className="text-caption max-w-xs"
                          >
                            <p>
                              {'This is the WhatsApp number you will contact the assistant with.'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <WhatsAppVerificationSection
                      assistantActions={assistantActions}
                      cost={creationCost}
                    />
                  </div>
                ) : (
                  <p className="text-body text-muted-foreground">No WhatsApp number configured.</p>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            {confirmDelete ? (
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
            ) : showDeleteButton && canWrite ? (
              <div className="flex w-full items-center justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDelete(activeTab as any)}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
              </div>
            ) : showCreateButton && canWrite ? (
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-body text-muted-foreground">
                    {creationCost !== null && creationCost > 0 ? (
                      <p>
                        Setup:{' '}
                        <span className="text-strong text-foreground">
                          {creationCost.toFixed(2)} Credits
                        </span>
                      </p>
                    ) : creationCost === null ? (
                      <p>
                        <span className="text-strong text-foreground">Setup fee applies</span>
                      </p>
                    ) : null}
                    {monthlyCost !== null && monthlyCost > 0 ? (
                      <p>
                        Monthly:{' '}
                        <span className="text-strong text-foreground">
                          {monthlyCost.toFixed(2)} Credits/mo
                        </span>
                      </p>
                    ) : monthlyCost === null ? (
                      <p>
                        <span className="text-strong text-foreground">
                          Monthly fee applies
                        </span>
                      </p>
                    ) : null}
                  </div>
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
                    <Button
                      onClick={submitContact}
                      disabled={isCreateButtonDisabled || isSubmitting}
                    >
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create
                    </Button>
                  </BillableActionGuard>
                </div>
              </div>
            ) : null}
          </DialogFooter>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
