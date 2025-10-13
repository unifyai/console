import * as React from 'react';
import { useFormContext, useWatch } from "react-hook-form";
import { Assistant, AssistantFormData, AvailableSocialPlatform } from '@/types/assistants/assistant';
import { EMAIL_DOMAIN_WITH_AT, ASSISTANT_ONBOARDING_FEE } from '@/constants/assistants/settings';

interface UseAssistantContactManagerProps {
    assistant: Assistant;
    formMethods: ReturnType<typeof useFormContext<AssistantFormData>>;
    isSubmitting: boolean;
    availableSocialPlatforms: AvailableSocialPlatform[];
    allAssistantEmails: string[];
    isOpen: boolean;
}

export function useAssistantContactManager({
    assistant,
    formMethods,
    isSubmitting,
    availableSocialPlatforms,
    allAssistantEmails,
    isOpen,
}: UseAssistantContactManagerProps) {
    const { register, setValue, formState: { errors, isDirty }, trigger, watch, getValues } = formMethods;

    const [activeTab, setActiveTab] = React.useState('email');
    const [emailLocalPart, setEmailLocalPart] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            const currentEmail = getValues("email");
            if (currentEmail && currentEmail.endsWith(EMAIL_DOMAIN_WITH_AT)) {
                setEmailLocalPart(currentEmail.substring(0, currentEmail.length - EMAIL_DOMAIN_WITH_AT.length));
            } else {
                setEmailLocalPart(currentEmail || '');
            }
        }
    }, [isOpen, getValues]);

    const handleLocalPartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLocalPart = event.target.value.replace(/[@\s]/g, '');
        setEmailLocalPart(newLocalPart);
        setValue("email", `${newLocalPart}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true, shouldDirty: true });
        setValue("isEmailAdded", true, { shouldDirty: true });
        setValue("emailManuallyEdited", true);
        trigger("email");
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
        if (!isDirty) return true;

        switch(activeTab) {
            case 'email':
                return !rhfIsEmailAdded || !!errors.email;
            case 'phone':
                return !rhfIsPhoneNumberAdded || !rhfUserPhoneIsVerified;
            case 'whatsapp':
                return !whatsAppAccount || !whatsAppAccount.identifier || !whatsAppAccount.isVerified;
            default:
                return true;
        }
    }, [isSubmitting, isDirty, activeTab, rhfIsEmailAdded, errors.email, rhfIsPhoneNumberAdded, rhfUserPhoneIsVerified, whatsAppAccount]);

    const showCreateButton =
      (activeTab === 'email' && !assistant.email) ||
      (activeTab === 'phone' && !assistant.phone) ||
      (activeTab === 'whatsapp' && !assistant.assistant_whatsapp_number);

    return {
        activeTab,
        setActiveTab,
        emailLocalPart,
        handleLocalPartChange,
        creationCost,
        isCreateButtonDisabled,
        showCreateButton,
    };
}
