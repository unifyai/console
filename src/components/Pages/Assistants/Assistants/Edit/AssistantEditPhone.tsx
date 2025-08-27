'use client';

import * as React from 'react';
import { UseFormReturn, useFormContext, useWatch } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { Loader2, AlertCircle, Info, Send, CheckCircle2, Phone } from 'lucide-react';
import { Assistant, AssistantActions, AssistantFormData, AvailablePhoneCountry } from '@/types/assistants/assistant';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { toast } from 'sonner';
import { useAccountVerification } from '@/hooks/Assistants/useAccountVerification';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { getCountryFlag } from '@/utils/assistants/country-utils';
import { FALLBACK_DEFAULT_COUNTRY_CODE } from '@/constants/assistants/settings';

// This is a self-contained verification component, adapted from HireForm
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
                         {verificationError && <p className="text-sm font-medium text-destructive mt-1 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{verificationError}</p>}
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
            {errors.user_phone && !isVerificationFlowActive && <p className="text-sm font-medium text-destructive mt-1">{errors.user_phone.message}</p>}
        </div>
    );
};


interface AssistantEditPhoneProps {
    isOpen: boolean;
    onClose: () => void;
    assistant: Assistant;
    formMethods: UseFormReturn<AssistantFormData>;
    onSubmit: () => Promise<void>;
    onSuccess: () => void;
    isSubmitting: boolean;
    assistantActions: AssistantActions;
}

export function AssistantEditPhone({
    isOpen,
    onClose,
    assistant,
    formMethods,
    onSubmit,
    onSuccess,
    isSubmitting,
    assistantActions,
}: AssistantEditPhoneProps) {
    const { register, setValue, formState: { errors }, control } = formMethods;
    const [availablePhoneCountries, setAvailablePhoneCountries] = React.useState<AvailablePhoneCountry[]>([]);
    const [isLoadingCountries, setIsLoadingCountries] = React.useState(true);

    const rhfCountry = useWatch({ control: formMethods.control, name: 'country' });
    const rhfUserPhone = useWatch({ control: formMethods.control, name: 'user_phone' });
    const rhfUserPhoneIsVerified = useWatch({ control: formMethods.control, name: 'user_phone_isVerified' });
    
    React.useEffect(() => {
        if (isOpen) {
            setIsLoadingCountries(true);
            assistantActions.contact.listAvailablePhoneCountries()
                .then(setAvailablePhoneCountries)
                .catch(() => toast.error("Could not load available countries."))
                .finally(() => setIsLoadingCountries(false));
            
            // Ensure the isPhoneNumberAdded flag is true when opening this dialog
            setValue('isPhoneNumberAdded', true, { shouldDirty: true });
        }
    }, [isOpen, assistantActions.contact, setValue]);
    
    const handleSubmit = async () => {
        await onSubmit();
        // The onSubmit (initiateUpdate) handles its own toasts.
        // We check for form errors after submission attempt. If none, call onSuccess.
        const userPhoneError = formMethods.getValues('user_phone') && formMethods.formState.errors.user_phone;
        if (!userPhoneError) {
            onSuccess();
        }
    };
    
    const displayName = `${assistant.first_name} ${assistant.surname}`;
    const isUpdateButtonDisabled = isSubmitting || isLoadingCountries || !rhfUserPhone || !rhfUserPhoneIsVerified || !rhfCountry;

    return (
        <Dialog open={isOpen} onOpenChange={!isSubmitting ? onClose : () => {}}>
            <DialogContent onInteractOutside={(e) => { if (isSubmitting) e.preventDefault(); }}>
                <DialogHeader>
                    <DialogTitle>Edit Phone Number for {displayName}</DialogTitle>
                    <DialogDescription>
                        Your assistant&apos;s number will be provisioned in the selected country. You may then contact them using the phone number you provide below.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <div className="flex flex-row gap-2 items-center pb-1">
                            <Label htmlFor="country">Assistant Phone Country</Label>
                            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-sm"><p>{"The country where your assistant's phone number will be based."}</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                        <Select value={rhfCountry || FALLBACK_DEFAULT_COUNTRY_CODE} onValueChange={(value) => setValue("country", value, { shouldValidate: true })} disabled={isSubmitting || isLoadingCountries} >
                            <SelectTrigger id="country" {...register("country", { required: "Phone number country is required." })}>
                                <SelectValue placeholder={isLoadingCountries ? "Loading available countries..." : "Select country..."} />
                            </SelectTrigger>
                            <SelectContent>{isLoadingCountries ? (<SelectItem value="loading" disabled>Loading...</SelectItem>) : (availablePhoneCountries.map(country => (<SelectItem key={country.code} value={country.code}><span className="mr-2">{getCountryFlag(country.code)}</span> {country.name} ({country.code})</SelectItem>)))}</SelectContent>
                        </Select>
                        {errors.country && <p className="text-sm font-medium text-destructive mt-1">{errors.country.message}</p>}
                    </div>
                    <div>
                        <div className="flex flex-row gap-2 items-center pb-1">
                            <Label htmlFor="user_phone">Your Phone</Label>
                            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-sm"><p>{"This is the phone number you will contact the assistant with."}</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                        <PhoneVerificationSection assistantActions={assistantActions} />
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={isUpdateButtonDisabled}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}