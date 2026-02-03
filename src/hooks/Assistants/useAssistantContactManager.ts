import * as React from 'react';
import { useForm } from 'react-hook-form';
import {
  Assistant,
  AssistantUpdatePayload,
  AvailableSocialPlatform,
  AvailablePhoneCountry,
  AssistantActions,
  ContactFormData,
  SocialAccount,
} from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import {
  EMAIL_DOMAIN_WITH_AT,
  ASSISTANT_ONBOARDING_FEE,
  FALLBACK_DEFAULT_COUNTRY_CODE,
} from '@/constants/assistants/settings';
import { getCountryName, getCountryFlag } from '@/utils/assistants/country-utils';
import { toast } from 'sonner';

interface UseAssistantContactManagerProps {
  assistant: Assistant;
  isOpen: boolean;
  assistantActions: AssistantActions;
  onSuccess: () => void;
  initialTab?: 'email' | 'phone' | 'whatsapp';
}

/**
 * Self-contained hook for managing assistant contact details.
 * Creates its own form state and initializes from the assistant prop.
 * Does not depend on any external form methods.
 */
export function useAssistantContactManager({
  assistant,
  isOpen,
  assistantActions,
  onSuccess,
  initialTab,
}: UseAssistantContactManagerProps) {
  // Create our own form for contact fields
  const contactFormMethods = useForm<ContactFormData>({
    mode: 'onChange',
    defaultValues: getDefaultContactValues(assistant),
  });

  const {
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors },
  } = contactFormMethods;

  // Phone countries state - fetched when dialog opens
  const [availablePhoneCountries, setAvailablePhoneCountries] = React.useState<
    AvailablePhoneCountry[]
  >([]);
  const [isLoadingPhoneCountries, setIsLoadingPhoneCountries] = React.useState(false);

  // Assistant emails state - fetched when dialog opens for email validation
  const [allAssistantEmails, setAllAssistantEmails] = React.useState<string[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = React.useState(false);

  // Social platforms state - fetched when dialog opens for WhatsApp tab
  const [availableSocialPlatforms, setAvailableSocialPlatforms] = React.useState<
    AvailableSocialPlatform[]
  >([]);
  const [isLoadingSocialPlatforms, setIsLoadingSocialPlatforms] = React.useState(false);

  // Reset form when dialog opens with new assistant data
  React.useEffect(() => {
    if (isOpen) {
      reset(getDefaultContactValues(assistant));
    }
  }, [isOpen, assistant, reset]);

  // Fetch phone countries when dialog opens
  React.useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadPhoneCountries() {
      setIsLoadingPhoneCountries(true);
      try {
        const countries = await assistantActions.contact.listAvailablePhoneCountries();
        if (cancelled) return;

        setAvailablePhoneCountries(countries);

        // Set default phone country if not already set or if current is not in list
        const currentPhoneCountry = getValues('phoneCountry');
        if (countries.length > 0) {
          const hasCurrentCountry = countries.some((c) => c.code === currentPhoneCountry);
          if (!currentPhoneCountry || !hasCurrentCountry) {
            const hasFallback = countries.some((c) => c.code === FALLBACK_DEFAULT_COUNTRY_CODE);
            setValue(
              'phoneCountry',
              hasFallback ? FALLBACK_DEFAULT_COUNTRY_CODE : countries[0].code,
              { shouldDirty: true }
            );
          }
        }
      } catch (error) {
        if (cancelled) return;
        // Fallback to US
        const usName = getCountryName('US') || 'United States';
        const usFlag = getCountryFlag('US');
        setAvailablePhoneCountries([{ code: 'US', name: usName, flag: usFlag }]);
        setValue('phoneCountry', 'US', { shouldDirty: true });
      } finally {
        if (!cancelled) {
          setIsLoadingPhoneCountries(false);
        }
      }
    }

    loadPhoneCountries();

    return () => {
      cancelled = true;
    };
  }, [isOpen, assistantActions.contact, getValues, setValue]);

  // Fetch assistant emails when dialog opens (for email uniqueness validation)
  React.useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadAssistantEmails() {
      setIsLoadingEmails(true);
      try {
        const result = await assistantActions.contact.listAllAssistantEmails();
        if (cancelled) return;

        if (Array.isArray(result)) {
          setAllAssistantEmails(result);
        } else {
          setAllAssistantEmails([]);
        }
      } catch (error) {
        if (cancelled) return;
        setAllAssistantEmails([]);
      } finally {
        if (!cancelled) {
          setIsLoadingEmails(false);
        }
      }
    }

    loadAssistantEmails();

    return () => {
      cancelled = true;
    };
  }, [isOpen, assistantActions.contact]);

  // Fetch social platforms when dialog opens (for WhatsApp cost calculation)
  React.useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadSocialPlatforms() {
      setIsLoadingSocialPlatforms(true);
      try {
        const result = await assistantActions.contact.listAvailableSocialPlatforms();
        if (cancelled) return;

        if (Array.isArray(result)) {
          setAvailableSocialPlatforms(result);
        } else {
          setAvailableSocialPlatforms([]);
        }
      } catch (error) {
        if (cancelled) return;
        setAvailableSocialPlatforms([]);
      } finally {
        if (!cancelled) {
          setIsLoadingSocialPlatforms(false);
        }
      }
    }

    loadSocialPlatforms();

    return () => {
      cancelled = true;
    };
  }, [isOpen, assistantActions.contact]);

  const [activeTab, setActiveTab] = React.useState<'email' | 'phone' | 'whatsapp'>(
    initialTab || 'email'
  );
  const [emailLocalPart, setEmailLocalPart] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<'email' | 'phone' | 'whatsapp' | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Self-contained submission state
  const [isSubmittingContact, setIsSubmittingContact] = React.useState(false);
  const toastIdRef = React.useRef<string | number | undefined>(undefined);

  // Initialize email local part when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      if (assistant.email) {
        if (assistant.email.endsWith(EMAIL_DOMAIN_WITH_AT)) {
          setEmailLocalPart(
            assistant.email.substring(0, assistant.email.length - EMAIL_DOMAIN_WITH_AT.length)
          );
        } else {
          setEmailLocalPart(assistant.email);
        }
      } else {
        const baseLocalPart = `${assistant.firstName}.${assistant.surname}`
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
        setValue('email', `${finalLocalPart}${EMAIL_DOMAIN_WITH_AT}`, {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue('isEmailAdded', true, { shouldDirty: true });
        setValue('emailManuallyEdited', false);
      }

      setConfirmDelete(null);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, assistant, initialTab, allAssistantEmails, setValue]);

  const handleLocalPartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLocalPart = event.target.value.replace(/[@\s]/g, '');
    setEmailLocalPart(newLocalPart);
    setValue('email', `${newLocalPart}${EMAIL_DOMAIN_WITH_AT}`, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue('isEmailAdded', true, { shouldDirty: true });
    setValue('emailManuallyEdited', true);
  };

  const handleProceedDelete = async () => {
    if (!confirmDelete || isDeleting) return;

    setIsDeleting(true);
    const toastId = toast.loading(`Deleting ${confirmDelete}...`);

    try {
      const result = await assistantActions.contact.delete(assistant.agentId, confirmDelete);

      if (result.detail) {
        throw new Error(result.detail);
      }
      toast.success(`Contact method deleted.`, { id: toastId });
      setConfirmDelete(null);
      onSuccess(); // This closes the dialog & refreshes assistants list
    } catch (error: any) {
      toast.error(`Failed to delete contact. Please try again.`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Self-contained contact submission.
   * Builds a payload with ONLY contact-specific fields based on the active tab,
   * then calls the assistant update API.
   */
  const submitContact = React.useCallback(async () => {
    if (isSubmittingContact) return;

    setIsSubmittingContact(true);
    toastIdRef.current = toast.loading('Updating contact...', { id: toastIdRef.current });

    try {
      // Build payload based on active tab - only include contact-specific fields
      const payload: Partial<AssistantUpdatePayload> = {};

      switch (activeTab) {
        case 'email': {
          const email = getValues('email');
          const isEmailAdded = getValues('isEmailAdded');

          if (!isEmailAdded) {
            throw new Error('No email to save.');
          }

          if (!email || !email.endsWith(EMAIL_DOMAIN_WITH_AT)) {
            throw new Error(`Valid email ending with ${EMAIL_DOMAIN_WITH_AT} is required.`);
          }

          payload.email = email;
          break;
        }

        case 'phone': {
          const userPhone = getValues('userPhone');
          const userPhoneIsVerified = getValues('userPhoneIsVerified');
          const isPhoneNumberAdded = getValues('isPhoneNumberAdded');
          const phoneCountry = getValues('phoneCountry');

          if (!isPhoneNumberAdded) {
            throw new Error('No phone number to save.');
          }

          if (userPhone && !userPhoneIsVerified) {
            throw new Error('Your phone number must be verified before saving.');
          }

          payload.userPhone = userPhone || null;
          payload.phoneCountry = phoneCountry || null;
          break;
        }

        case 'whatsapp': {
          const socialAccountsValue = getValues('socialAccounts');
          const whatsappAccount = socialAccountsValue?.find(
            (acc) => acc.platform === 'whatsapp' && acc.isVerified
          );

          if (!whatsappAccount || !whatsappAccount.identifier) {
            throw new Error('WhatsApp account must be verified before saving.');
          }

          payload.userWhatsappNumber = whatsappAccount.identifier;
          break;
        }
      }

      // Call the update API with contact-only payload
      const updateResult = await assistantActions.assistant.update(assistant.agentId, payload);

      if ((updateResult as ResponseProps).detail) {
        throw new Error((updateResult as ResponseProps).detail);
      }

      toast.success('Contact updated successfully!', { id: toastIdRef.current });
      toastIdRef.current = undefined;
      onSuccess();
    } catch (error: any) {
      // Show specific error message if available
      const errorMessage = error?.message || 'An error occurred while updating contact.';
      toast.error(errorMessage, { id: toastIdRef.current });
      toastIdRef.current = undefined;
    } finally {
      setIsSubmittingContact(false);
    }
  }, [
    isSubmittingContact,
    activeTab,
    getValues,
    assistant.agentId,
    assistantActions.assistant,
    onSuccess,
  ]);

  // Watch form values for reactive UI updates
  const isEmailAdded = watch('isEmailAdded');
  const isPhoneNumberAdded = watch('isPhoneNumberAdded');
  const userPhoneIsVerified = watch('userPhoneIsVerified');
  const socialAccounts = watch('socialAccounts');
  const whatsAppAccount = socialAccounts?.find((acc) => acc.platform === 'whatsapp');

  const creationCost = React.useMemo(() => {
    switch (activeTab) {
      case 'email':
      case 'phone':
        return 0;
      case 'whatsapp':
        const platformInfo = availableSocialPlatforms.find((p) => p.name === 'whatsapp');
        return platformInfo?.cost ?? ASSISTANT_ONBOARDING_FEE;
      default:
        return 0;
    }
  }, [activeTab, availableSocialPlatforms]);

  const isCreateButtonDisabled = React.useMemo(() => {
    if (isSubmittingContact) return true;

    switch (activeTab) {
      case 'email':
        // Button should be enabled if email is added and the local part is not empty
        return !isEmailAdded || !emailLocalPart;
      case 'phone':
        // Button should be enabled if a phone number is being added AND it's verified.
        const phoneValue = getValues('userPhone');
        return !isPhoneNumberAdded || !userPhoneIsVerified || !phoneValue;
      case 'whatsapp':
        // Button should be enabled if the account exists, has an identifier, and is verified.
        return !whatsAppAccount || !whatsAppAccount.identifier || !whatsAppAccount.isVerified;
      default:
        return true;
    }
  }, [
    isSubmittingContact,
    activeTab,
    isEmailAdded,
    emailLocalPart,
    isPhoneNumberAdded,
    userPhoneIsVerified,
    whatsAppAccount,
    getValues,
  ]);

  const showCreateButton =
    (activeTab === 'email' && !assistant.email) ||
    (activeTab === 'phone' && !assistant.phone) ||
    (activeTab === 'whatsapp' && !assistant.assistantWhatsappNumber);

  const showDeleteButton =
    (activeTab === 'email' && !!assistant.email) ||
    (activeTab === 'phone' && !!assistant.phone) ||
    (activeTab === 'whatsapp' && !!assistant.assistantWhatsappNumber);

  return {
    // Form methods for component bindings
    contactFormMethods,
    // Tab state
    activeTab,
    setActiveTab,
    // Email management
    emailLocalPart,
    handleLocalPartChange,
    allAssistantEmails,
    isLoadingEmails,
    // Phone countries
    availablePhoneCountries,
    isLoadingPhoneCountries,
    // Social platforms (WhatsApp)
    availableSocialPlatforms,
    isLoadingSocialPlatforms,
    // Button states
    creationCost,
    isCreateButtonDisabled,
    showCreateButton,
    showDeleteButton,
    // Delete confirmation
    confirmDelete,
    setConfirmDelete,
    isDeleting,
    handleProceedDelete,
    // Self-contained contact submission
    submitContact,
    isSubmittingContact,
  };
}

/**
 * Helper to create default contact form values from an assistant object.
 */
function getDefaultContactValues(assistant: Assistant): ContactFormData {
  const socialAccounts: SocialAccount[] = [];
  if (assistant.userWhatsappNumber) {
    socialAccounts.push({
      platform: 'whatsapp',
      identifier: assistant.userWhatsappNumber,
      isVerified: true,
      isInitial: true,
      isVerifying: false,
      verificationCodeSent: null,
      verificationSentAt: null,
      verificationAttempts: 0,
      verificationError: null,
    });
  }

  return {
    // Email
    email: assistant.email || null,
    isEmailAdded: !!assistant.email,
    emailManuallyEdited: !!assistant.email,

    // Phone
    userPhone: assistant.userPhone || '',
    userPhoneIsVerified: !!assistant.userPhone,
    userPhoneIsVerifying: false,
    userPhoneVerificationCodeSent: null,
    userPhoneVerificationSentAt: null,
    userPhoneVerificationAttempts: 0,
    userPhoneVerificationError: null,
    phoneCountry: assistant.phoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE,
    isPhoneNumberAdded: !!assistant.phone,

    // WhatsApp / Social
    userWhatsappNumber: assistant.userWhatsappNumber || null,
    socialAccounts,
  };
}
