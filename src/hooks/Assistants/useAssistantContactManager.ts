import * as React from 'react';
import { useFormContext, useWatch } from "react-hook-form";
import { Assistant, AssistantFormData, AvailableSocialPlatform, AssistantActions } from '@/types/assistants/assistant';
import { EMAIL_DOMAIN_WITH_AT, ASSISTANT_ONBOARDING_FEE } from '@/constants/assistants/settings';
import { toast } from 'sonner';

interface UseAssistantContactManagerProps {
    assistant: Assistant;
    formMethods: ReturnType<typeof useFormContext<AssistantFormData>>;
    isSubmitting: boolean;
    availableSocialPlatforms: AvailableSocialPlatform[];
    allAssistantEmails: string[];
    isOpen: boolean;
    assistantActions: AssistantActions;
    onSuccess: () => void;
    initialTab?: 'email' | 'phone' | 'whatsapp';
}

export function useAssistantContactManager({
    assistant,
    formMethods,
    isSubmitting,
    availableSocialPlatforms,
    allAssistantEmails,
    isOpen,
    assistantActions,
    onSuccess,
    initialTab,
}: UseAssistantContactManagerProps) {
    const { register, setValue, formState: { errors, isDirty }, trigger, watch, getValues } = formMethods;

    const [activeTab, setActiveTab] = React.useState<'email' | 'phone' | 'whatsapp'>(initialTab || 'email');
    const [emailLocalPart, setEmailLocalPart] = React.useState('');
    const [confirmDelete, setConfirmDelete] = React.useState<'email' | 'phone' | 'whatsapp' | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            if (assistant.email) {
                const currentEmail = getValues("email");
                if (currentEmail && currentEmail.endsWith(EMAIL_DOMAIN_WITH_AT)) {
                    setEmailLocalPart(currentEmail.substring(0, currentEmail.length - EMAIL_DOMAIN_WITH_AT.length));
                } else {
                    setEmailLocalPart(currentEmail || '');
                }
            } else {
                const baseLocalPart = `${assistant.first_name}.${assistant.surname}`
                    .toLowerCase()
                    .replace(/\s+/g, '.')
                    .replace(/[^a-z0-9.]/g, '');

                let finalLocalPart = baseLocalPart;
                let counter = 1;                
                while (allAssistantEmails.includes(`${finalLocalPart}${EMAIL_DOMAIN_WITH_AT}`)) {
                    finalLocalPart = `${baseLocalPart}${counter}`;
                    counter++;
                }
                setEmailLocalPart(finalLocalPart);
                setValue("email", `${finalLocalPart}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true, shouldDirty: true });
                setValue("isEmailAdded", true, { shouldDirty: true });
                setValue("emailManuallyEdited", false);
            }

            setConfirmDelete(null);
            if (initialTab) {
                setActiveTab(initialTab);
            }
        }
    }, [isOpen, assistant, initialTab, allAssistantEmails, setValue, getValues]);

    const handleLocalPartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLocalPart = event.target.value.replace(/[@\s]/g, '');
        setEmailLocalPart(newLocalPart);
        setValue("email", `${newLocalPart}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true, shouldDirty: true });
        setValue("isEmailAdded", true, { shouldDirty: true });
        setValue("emailManuallyEdited", true);
        trigger("email");
    };
    
    const handleProceedDelete = async () => {
        if (!confirmDelete || isDeleting) return;

        setIsDeleting(true);
        const toastId = toast.loading(`Deleting ${confirmDelete}...`);

        try {
            const result = await assistantActions.contact.delete(assistant.agent_id, confirmDelete);

            if (result.detail) {
                throw new Error(result.detail);
            }
            toast.success(`Contact method deleted.`, { id: toastId });
            setConfirmDelete(null);
            onSuccess(); // This closes the dialog & refreshes assistants list
        } catch (error: any) {
            console.error("[useAssistantContactManager] Delete Error:", error.message);
            toast.error(`Failed to delete contact. Please try again.`, { id: toastId });
        } finally {
            setIsDeleting(false);
        }
    };


    const rhfIsEmailAdded = watch("isEmailAdded");
    const rhfIsPhoneNumberAdded = watch("isPhoneNumberAdded");
    const rhfUserPhoneIsVerified = watch("user_phone_isVerified");
    const socialAccounts = watch("social_accounts");
    const whatsAppAccount = socialAccounts?.find(acc => acc.platform === 'whatsapp');

    const creationCost = React.useMemo(() => {
        switch (activeTab) {
            case 'email':
            case 'phone':
                return 0;
            case 'whatsapp':
                const platformInfo = availableSocialPlatforms.find(p => p.name === 'whatsapp');
                return platformInfo?.cost ?? ASSISTANT_ONBOARDING_FEE;
            default:
                return 0;
        }
    }, [activeTab, availableSocialPlatforms]);

    const isCreateButtonDisabled = React.useMemo(() => {
        if (isSubmitting) return true;
    
        switch(activeTab) {
            case 'email':
                // Button should be enabled if email is added, there are no errors, and the local part is not empty
                return !rhfIsEmailAdded || !!errors.email || !emailLocalPart;
            case 'phone':
                // Button should be enabled if a phone number is being added AND it's verified.
                const phoneValue = getValues('user_phone');
                return !rhfIsPhoneNumberAdded || !rhfUserPhoneIsVerified || !phoneValue;
            case 'whatsapp':
                // Button should be enabled if the account exists, has an identifier, and is verified.
                return !whatsAppAccount || !whatsAppAccount.identifier || !whatsAppAccount.isVerified;
            default:
                return true;
        }
    }, [isSubmitting, activeTab, rhfIsEmailAdded, errors.email, emailLocalPart, rhfIsPhoneNumberAdded, rhfUserPhoneIsVerified, whatsAppAccount, getValues]);

    const showCreateButton =
      (activeTab === 'email' && !assistant.email) ||
      (activeTab === 'phone' && !assistant.phone) ||
      (activeTab === 'whatsapp' && !assistant.assistant_whatsapp_number);
    
    const showDeleteButton =
      (activeTab === 'email' && !!assistant.email) ||
      (activeTab === 'phone' && !!assistant.phone) ||
      (activeTab === 'whatsapp' && !!assistant.assistant_whatsapp_number);


    return {
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
    };
}