'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/UI/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs";
import { Button } from "@/components/UI/button";
import { Input } from "@/components/UI/input";
import { Label } from "@/components/UI/label";
import { Loader2, Mail, Phone, CheckCircle2, AlertCircle, Send, Info } from 'lucide-react';
import { Assistant, AssistantFormData, AssistantActions, AvailablePhoneCountry, AvailableSocialPlatform } from '@/types/assistants/assistant';
import { UseFormReturn, useFormContext, useWatch, useFieldArray } from "react-hook-form";
import { EMAIL_DOMAIN_WITH_AT, FALLBACK_DEFAULT_COUNTRY_CODE, ASSISTANT_ONBOARDING_FEE } from '@/constants/assistants/settings';
import { useAccountVerification } from '@/hooks/Assistants/useAccountVerification';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { getCountryFlag } from '@/utils/assistants/country-utils';
import { toast } from 'sonner';
import { WhatsApp } from '@mui/icons-material';
import { cn } from "@/lib/utils";
import { getPlatformIcon } from '@/utils/assistants/platform-utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/UI/tooltip';
import { useAssistantContactManager } from '@/hooks/Assistants/useAssistantContactManager';

const PhoneVerificationSection: React.FC<{ assistantActions: AssistantActions }> = ({ assistantActions }) => {
    const { control, getValues, setValue, formState: { errors }, register, clearErrors } = useFormContext<AssistantFormData>();

    const phoneFieldNames = React.useMemo(() => ({
        identifier: 'user_phone' as 'user_phone',
        isVerified: 'user_phone_isVerified' as 'user_phone_isVerified',
        isVerifying: 'user_phone_isVerifying' as 'user_phone_isVerifying',
        verificationCodeSent: 'user_phone_verificationCodeSent' as 'user_phone_verificationCodeSent',
        verificationSentAt: 'user_phone_verificationSentAt' as 'user_phone_verificationSentAt',
        verificationAttempts: 'user_phone_verificationAttempts' as 'user_phone_verificationAttempts',
        verificationError: 'user_phone_verificationError' as 'user_phone_verificationError',
    }), []);

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
    } = useAccountVerification({
        platform: 'phone',
        fieldNames: phoneFieldNames,
        assistantActions
    });

    const handleVerifyClick = (isRetry: boolean) => {
        const phoneNumber = getValues('user_phone');
        if (!phoneNumber || phoneNumber.trim() === '') {
            toast.error("Please enter a phone number to verify.");
            return;
        }
        handleVerify(isRetry);
    };

    const isPhoneVerified = useWatch({ control, name: 'user_phone_isVerified' });
    const phoneValue = useWatch({ control, name: 'user_phone' });
    const isSubmitting = useFormContext<AssistantFormData>().formState.isSubmitting;

    return (
        <div className="space-y-2">
             <div className="flex items-center gap-2">
                <Input id="user_phone" type="tel" placeholder="e.g., +15551234567" className="h-9 flex-1" disabled={isVerifying || isSubmitting || isPhoneVerified} {...register('user_phone', {
                    pattern: {
                        value: /^\+[1-9]\d{7,14}$/,
                        message: "Please enter a valid number (e.g., +15551234567). Make sure there are no extra whitespace."
                    },
                    onChange: () => {
                        if (getValues('user_phone_isVerified')) {
                            setValue('user_phone_isVerified', false, { shouldDirty: true });
                        }
                        if (errors.user_phone) clearErrors('user_phone');
                        setValue('isPhoneNumberAdded', true, { shouldDirty: true });
                    }
                })} />
                {isPhoneVerified ? (
                     <Button type="button" variant="default" className="h-9" disabled>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
                    </Button>
                ) : (
                    <Button type="button" variant="outline" className="h-9" onClick={() => handleVerifyClick(false)} disabled={isVerifying || isSubmitting || !phoneValue}>
                        {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isVerifying ? 'Verifying...' : 'Verify'}
                    </Button>
                )}
            </div>
            {isVerificationFlowActive && (
                <div className="pl-4 flex items-start gap-3 border-l-2 border-muted">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <Input
                                id="user_phone_verification_code"
                                placeholder="Enter verification code..."
                                value={verificationInput}
                                onChange={(e) => setVerificationInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitCode(); } }}
                                className={cn("h-9", verificationError && "border-destructive")}
                            />
                            <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSubmitCode}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                         {verificationError && <p className="text-body text-strong text-destructive mt-1 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{verificationError}</p>}
                    </div>
                    <div className="flex items-center gap-2 pt-0">
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => handleVerifyClick(true)} disabled={cooldown > 0}>
                            {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
                        </Button>
                        <Button type="button" variant="warning" size="sm" className="h-9" onClick={handleCancelVerification}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
            {errors.user_phone && !isVerificationFlowActive && <p className="text-body text-strong text-destructive mt-1">{errors.user_phone.message}</p>}
        </div>
    );
};

const WhatsAppVerificationSection: React.FC<{ assistantActions: AssistantActions, cost: number }> = ({ assistantActions, cost }) => {
    const { control, getValues, setValue, formState: { errors }, clearErrors } = useFormContext<AssistantFormData>();
    const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
    
    const { fields, append } = useFieldArray({ control, name: "social_accounts" });
    const whatsAppAccountIndex = fields.findIndex(field => field.platform === 'whatsapp');

    React.useEffect(() => {
        if (whatsAppAccountIndex === -1) {
            append({ platform: 'whatsapp', identifier: '', isVerified: false, isVerifying: false, verificationCodeSent: null, verificationSentAt: null, verificationAttempts: 0, verificationError: null, isInitial: false });
        }
    }, [whatsAppAccountIndex, append]);
    
    const account = useWatch({ control, name: `social_accounts.${whatsAppAccountIndex}` });

    const fieldNames = React.useMemo(() => ({
        identifier: `social_accounts.${whatsAppAccountIndex}.identifier` as const,
        isVerified: `social_accounts.${whatsAppAccountIndex}.isVerified` as const,
        isVerifying: `social_accounts.${whatsAppAccountIndex}.isVerifying` as const,
        verificationCodeSent: `social_accounts.${whatsAppAccountIndex}.verificationCodeSent` as const,
        verificationSentAt: `social_accounts.${whatsAppAccountIndex}.verificationSentAt` as const,
        verificationAttempts: `social_accounts.${whatsAppAccountIndex}.verificationAttempts` as const,
        verificationError: `social_accounts.${whatsAppAccountIndex}.verificationError` as const,
    }), [whatsAppAccountIndex]);

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
    } = useAccountVerification({
        platform: 'whatsapp',
        fieldNames,
        assistantActions
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
        if (errors.social_accounts?.[whatsAppAccountIndex]?.identifier) {
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
                    id={`social_accounts_${whatsAppAccountIndex}_identifier`}
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
                                <Button type="button" variant="outline" className="h-9" onClick={() => handleVerifyClick(false)} disabled={isVerifying || !account?.identifier}>
                                    {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {isVerifying ? 'Verifying...' : 'Verify'}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Costs ${cost.toFixed(2)} credits to pair with your assistant. Verify first to link.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
            {isVerificationFlowActive && (
            <div className="pl-4 flex items-start gap-3 border-l-2 border-muted">
                <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                        <Input
                            id={`social_accounts_${whatsAppAccountIndex}_verification_code`}
                            placeholder="Enter verification code..."
                            value={verificationInput}
                            onChange={(e) => setVerificationInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleSubmitCode(); }}}
                            className={cn("h-9", verificationError && "border-destructive")}
                        />
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSubmitCode}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                        {verificationError && <p className="text-body text-strong text-destructive mt-1 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{verificationError}</p>}
                </div>
                <div className="flex items-center gap-2 pt-0">
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => handleVerifyClick(true)} disabled={cooldown > 0}>
                        {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
                    </Button>
                    <Button type="button" variant="warning" size="sm" className="h-9" onClick={handleCancelVerification}>
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
    formMethods: UseFormReturn<AssistantFormData>;
    onSubmit: () => Promise<void>;
    isSubmitting: boolean;
    assistantActions: AssistantActions;
    allAssistantEmails: string[];
    availablePhoneCountries: AvailablePhoneCountry[];
    isLoadingCountries: boolean;
    availableSocialPlatforms: AvailableSocialPlatform[];
    onSuccess: () => void;
}

export function AssistantContactManager({
    isOpen,
    onClose,
    assistant,
    formMethods,
    onSubmit,
    isSubmitting,
    assistantActions,
    allAssistantEmails,
    availablePhoneCountries,
    isLoadingCountries,
    availableSocialPlatforms,
    onSuccess,
}: AssistantContactManagerProps) {
    const { register, setValue, formState: { errors }, getValues, control } = formMethods;
    
    const {
        activeTab,
        setActiveTab,
        emailLocalPart,
        handleLocalPartChange,
        creationCost,
        isCreateButtonDisabled,
        showCreateButton,
        showDeleteButton,
        confirmDelete,
        setConfirmDelete,
        isDeleting,
        handleProceedDelete,
    } = useAssistantContactManager({
        assistant,
        formMethods: formMethods as any, 
        isSubmitting,
        availableSocialPlatforms,
        allAssistantEmails,
        isOpen,
        assistantActions,
        onSuccess,
    });

    const rhfCountry = useWatch({ control, name: 'country' });

    const handleDialogClose = (open: boolean) => {
        if (!isSubmitting && !isDeleting) {
            if (!open) {
                onClose();
            }
        }
    }

    const handleInteractOutside = (e: React.MouseEvent) => {
        if (isSubmitting || isDeleting) {
            e.preventDefault();
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent onInteractOutside={handleInteractOutside as any}>
                <DialogHeader>
                    <DialogTitle className="text-title">Update Contact</DialogTitle>
                    <DialogDescription className="text-subtitle">
                        Manage contact details for {assistant.first_name}.
                    </DialogDescription>
                </DialogHeader>

                {confirmDelete ? (
                    <div className="py-8 text-center">
                        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                        <h3 className="mt-4 text-lg font-medium">Are you sure?</h3>
                        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                            Deleting the {confirmDelete} contact method is irreversible. You can add a new one again at any time.
                        </p>
                    </div>
                ) : (
                    <Tabs value={activeTab} className="w-full pt-4" onValueChange={(value) => setActiveTab(value as any)}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="email"><Mail className="h-4 w-4 mr-2" /> Email</TabsTrigger>
                            <TabsTrigger value="phone"><Phone className="h-4 w-4 mr-2" /> Phone</TabsTrigger>
                            <TabsTrigger value="whatsapp"><WhatsApp sx={{ fontSize: '18px', marginRight: '8px' }}/> WhatsApp</TabsTrigger>
                        </TabsList>
                        <TabsContent value="email" className="py-4">
                            {assistant.email ? (
                                <div>
                                    <Label>Email Address</Label>
                                    <Input value={assistant.email} readOnly disabled className="mt-1" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="email_local_part">Email address</Label>
                                    <div className="flex items-center rounded-md">
                                        <Input
                                            id="email_local_part" type="text" value={emailLocalPart}
                                            onChange={handleLocalPartChange} placeholder="new-assistant"
                                            className="flex-1 max-w-[250px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-none h-9"
                                            disabled={isSubmitting}
                                        />
                                        <span className="px-3 py-2 bg-muted text-muted-foreground text-caption rounded-r-md border-l border-input select-none h-9 flex items-center">{EMAIL_DOMAIN_WITH_AT}</span>
                                    </div>
                                    <input type="hidden" {...register("email", {
                                        validate: (value) => {
                                            if (getValues("isEmailAdded")) {
                                                if (!value || !value.endsWith(EMAIL_DOMAIN_WITH_AT) || value.startsWith('@')) return "A valid email is required.";
                                                if (allAssistantEmails.includes(value) && value !== assistant.email) return "This email is already taken.";
                                            }
                                            return true;
                                        }
                                    })} />
                                    {errors.email && <p className="text-body text-strong text-destructive mt-1">{errors.email.message}</p>}
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="phone" className="py-4">
                            {assistant.phone ? (
                                <div>
                                    <Label>Assistant Phone Number</Label>
                                    <Input value={assistant.phone} readOnly disabled className="mt-1" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex flex-row gap-2 items-center pb-1">
                                            <Label htmlFor="country">Assistant Phone Country</Label>
                                            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-caption"><p>{"The country where your assistant's phone number will be based."}</p></TooltipContent></Tooltip></TooltipProvider>
                                        </div>
                                        <Select value={rhfCountry || FALLBACK_DEFAULT_COUNTRY_CODE} onValueChange={(value) => {setValue("country", value, { shouldDirty: true, shouldValidate: true }); setValue("isPhoneNumberAdded", true, { shouldDirty: true });}} disabled={isSubmitting || isLoadingCountries} >
                                            <SelectTrigger id="country" {...register("country", { required: getValues("isPhoneNumberAdded") ? "Country is required." : false })}>
                                                <SelectValue placeholder={isLoadingCountries ? "Loading countries..." : "Select country..."} />
                                            </SelectTrigger>
                                            <SelectContent>{isLoadingCountries ? (<SelectItem value="loading" disabled>Loading...</SelectItem>) : (availablePhoneCountries.map(country => (<SelectItem key={country.code} value={country.code}><span className="mr-2">{getCountryFlag(country.code)}</span> {country.name} ({country.code})</SelectItem>)))}</SelectContent>
                                        </Select>
                                        {errors.country && <p className="text-body text-strong text-destructive mt-1">{errors.country.message}</p>}
                                    </div>
                                    <div>
                                        <div className="flex flex-row gap-2 items-center pb-1">
                                            <Label htmlFor="user_phone">Your Phone</Label>
                                            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-caption"><p>{"This is the phone number you will contact the assistant with."}</p></TooltipContent></Tooltip></TooltipProvider>
                                        </div>
                                        <PhoneVerificationSection assistantActions={assistantActions} />
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="whatsapp" className="py-4">
                            {assistant.assistant_whatsapp_number ? (
                                <div>
                                    <Label>WhatsApp Number</Label>
                                    <Input value={assistant.assistant_whatsapp_number} readOnly disabled className="mt-1" />
                                </div>
                            ) : (
                                <div>
                                    <div className="flex flex-row gap-2 items-center pb-1">
                                        <Label htmlFor="user_whatsapp">Your WhatsApp Number</Label>
                                        <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-caption"><p>{"This is the WhatsApp number you will contact the assistant with."}</p></TooltipContent></Tooltip></TooltipProvider>
                                    </div>
                                    <WhatsAppVerificationSection assistantActions={assistantActions} cost={creationCost} />
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}

                <DialogFooter>
                    {confirmDelete ? (
                         <div className="w-full flex justify-end items-center gap-2">
                            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleProceedDelete} disabled={isDeleting}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Proceed
                            </Button>
                        </div>
                    ) : showDeleteButton ? (
                        <div className="w-full flex justify-end items-center">
                             <Button variant="destructive" onClick={() => setConfirmDelete(activeTab as any)} disabled={isSubmitting}>
                                Delete
                            </Button>
                        </div>
                    ) : showCreateButton ? (
                        <div className="w-full flex justify-between items-center">
                            <p className="text-body text-muted-foreground">
                                Cost: <span className="text-strong text-foreground">{creationCost.toFixed(2)} Credits</span>
                            </p>
                            <Button onClick={onSubmit} disabled={isCreateButtonDisabled}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create
                            </Button>
                        </div>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
