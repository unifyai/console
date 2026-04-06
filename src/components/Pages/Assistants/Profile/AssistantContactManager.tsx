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
import { Loader2, Mail, Phone, CheckCircle2, AlertCircle, Info, Copy, Check } from 'lucide-react';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { FormProvider, useWatch } from 'react-hook-form';
import {
  EMAIL_DOMAIN_WITH_AT,
  FALLBACK_DEFAULT_COUNTRY_CODE,
} from '@/constants/assistants/settings';
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
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/UI/tooltip';
import { useAssistantContactManager } from '@/hooks/Assistants/useAssistantContactManager';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';

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
  /** User's phone number from their profile */
  userPhoneNumber?: string | null;
  /** User's WhatsApp number from their profile */
  userWhatsappNumber?: string | null;
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
  userPhoneNumber,
  userWhatsappNumber,
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
                  <DisplayContactField label="Email Address" value={assistant.email} />
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
                  <DisplayContactField label="Assistant Phone Number" value={assistant.phone} />
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
                        }}
                        disabled={isSubmitting || isLoadingPhoneCountries}
                      >
                        <SelectTrigger
                          id="phoneCountry"
                          {...register('phoneCountry', {
                            required: 'Country is required.',
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
                        <Label>Your Phone</Label>
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
                ) : (
                  <p className="text-body text-muted-foreground">No phone number configured.</p>
                )}
              </TabsContent>
              <TabsContent value="whatsapp" className="py-4">
                {assistant.assistantWhatsappNumber ? (
                  <DisplayContactField
                    label="Assistant WhatsApp Number"
                    value={assistant.assistantWhatsappNumber}
                  />
                ) : canWrite ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-row items-center gap-2 pb-1">
                        <Label>Your WhatsApp</Label>
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
                                The WhatsApp number you will use to message your assistant. Manage it
                                in your profile.
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
                ) : (
                  <p className="text-body text-muted-foreground">No WhatsApp configured.</p>
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
                        <span className="text-strong text-foreground">Monthly fee applies</span>
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
