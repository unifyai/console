'use client';

import * as React from 'react';
import { UseFormReturn, useFormContext, useWatch } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { Loader2, Mail } from 'lucide-react';
import { Assistant, AssistantFormData } from '@/types/assistants/assistant';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { EMAIL_DOMAIN_WITH_AT } from '@/constants/assistants/settings';

interface AssistantEditEmailProps {
    isOpen: boolean;
    onClose: () => void;
    assistant: Assistant;
    formMethods: UseFormReturn<AssistantFormData>;
    onSubmit: () => Promise<void>;
    onSuccess: () => void;
    isSubmitting: boolean;
    allAssistantEmails: string[];
}

export function AssistantEditEmail({
    isOpen,
    onClose,
    assistant,
    formMethods,
    onSubmit,
    onSuccess,
    isSubmitting,
    allAssistantEmails,
}: AssistantEditEmailProps) {
    const { register, setValue, formState: { errors }, trigger, watch, getValues } = formMethods;
    
    const rhfEmail = watch("email");
    const [emailLocalPart, setEmailLocalPart] = React.useState('');

    // Sync local part state from RHF's full email when dialog opens or assistant changes
    React.useEffect(() => {
        if (isOpen) {
            // Ensure the isEmailAdded flag is true when opening this dialog
            setValue('isEmailAdded', true, { shouldDirty: true });
            
            const currentEmail = getValues("email");
            if (currentEmail && currentEmail.endsWith(EMAIL_DOMAIN_WITH_AT)) {
                setEmailLocalPart(currentEmail.substring(0, currentEmail.length - EMAIL_DOMAIN_WITH_AT.length));
            } else {
                setEmailLocalPart(currentEmail || '');
            }
        }
    }, [isOpen, assistant, setValue, getValues]);

    const handleLocalPartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLocalPart = event.target.value.replace(/[@\s]/g, '');
        setEmailLocalPart(newLocalPart);
        setValue("email", `${newLocalPart}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true });
        setValue("emailManuallyEdited", true);
        trigger("email");
    };

    const handleSubmit = async () => {
        await onSubmit();
        // onSubmit (initiateUpdate) handles its own toasts.
        // We check for form errors after submission attempt. If none, call onSuccess.
        if (!formMethods.formState.errors.email) {
            onSuccess();
        }
    };
    
    const displayName = `${assistant.first_name} ${assistant.surname}`;
    const isUpdateButtonDisabled = isSubmitting || !rhfEmail || !!errors.email;

    return (
        <Dialog open={isOpen} onOpenChange={!isSubmitting ? onClose : () => {}}>
            <DialogContent onInteractOutside={(e) => { if (isSubmitting) e.preventDefault(); }}>
                <DialogHeader>
                    <DialogTitle className="text-title">Edit Email for {displayName}</DialogTitle>
                    <DialogDescription className="text-subtitle">
                        Provide a unique email address for your assistant.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <div className="flex flex-row items-center gap-2 mb-1.5">
                            <Label htmlFor="email_local_part">Email address</Label>
                        </div>
                        <div className="flex items-center rounded-md">
                            <Input
                                id="email_local_part"
                                type="text"
                                value={emailLocalPart}
                                onChange={handleLocalPartChange}
                                placeholder="new-assistant"
                                className="flex max-w-[250px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-none h-9"
                                aria-describedby="email_domain_part"
                                disabled={isSubmitting}
                            />
                            <span
                                id="email_domain_part"
                                className="px-3 py-2 bg-muted text-muted-foreground text-caption rounded-r-md border-l border-input select-none h-9 flex items-center" >
                                {EMAIL_DOMAIN_WITH_AT}
                            </span>
                        </div>
                        <input type="hidden" {...register("email", {
                            validate: (value) => {
                                if (!value) return "Email is required";
                                if (!value.endsWith(EMAIL_DOMAIN_WITH_AT)) return `Valid email must end with ${EMAIL_DOMAIN_WITH_AT}`;
                                if (value.startsWith('@')) return `Email local part cannot be empty.`;
                                // When editing, we should check if the email is taken by *another* assistant
                                if (allAssistantEmails.includes(value) && value !== assistant.email) {
                                    return "This email is already in use by another assistant.";
                                }
                                return true;
                            }
                        })} />
                        {errors.email && <p className="text-body text-strong text-destructive mt-1">{errors.email.message}</p>}
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