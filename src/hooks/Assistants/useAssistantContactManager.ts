import * as React from 'react';
import { useForm } from 'react-hook-form';
import {
  Assistant,
  AvailableSocialPlatform,
  AvailablePhoneCountry,
  AssistantActions,
  ContactFormData,
} from '@/types/assistants/assistant';
import { ContactCosts, AssistantContactCreatePayload } from '@/types/assistants/contact';
import { ResponseProps } from '@/types/common';
import {
  EMAIL_DOMAIN_WITH_AT,
  FALLBACK_DEFAULT_COUNTRY_CODE,
} from '@/constants/assistants/settings';
import { getCountryName, getCountryFlag } from '@/utils/assistants/country-utils';
import { fetchVisitorCountry } from '@/utils/geo';
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

  // Contact costs state - fetched from the admin billing endpoint
  const [contactCosts, setContactCosts] = React.useState<ContactCosts | null>(null);
  const [isLoadingContactCosts, setIsLoadingContactCosts] = React.useState(false);

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
        const [countries, visitorCountry] = await Promise.all([
          assistantActions.contact.listAvailablePhoneCountries(),
          fetchVisitorCountry(),
        ]);
        if (cancelled) return;

        setAvailablePhoneCountries(countries);

        const currentPhoneCountry = getValues('phoneCountry');
        if (countries.length > 0) {
          const hasCurrentCountry = countries.some((c) => c.code === currentPhoneCountry);
          if (!currentPhoneCountry || !hasCurrentCountry) {
            const preferredDefault = visitorCountry ?? FALLBACK_DEFAULT_COUNTRY_CODE;
            const hasPreferred = countries.some((c) => c.code === preferredDefault);
            const hasFallback = countries.some((c) => c.code === FALLBACK_DEFAULT_COUNTRY_CODE);
            setValue(
              'phoneCountry',
              hasPreferred
                ? preferredDefault
                : hasFallback
                  ? FALLBACK_DEFAULT_COUNTRY_CODE
                  : countries[0].code,
              { shouldDirty: true }
            );
          }
        }
      } catch (error) {
        if (cancelled) return;
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

  // Fetch contact costs from the admin billing endpoint when dialog opens
  React.useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadContactCosts() {
      setIsLoadingContactCosts(true);
      try {
        const result = await assistantActions.contact.fetchContactCosts();
        if (cancelled) return;

        if ('detail' in result && typeof (result as ResponseProps).detail === 'string') {
          // Fetch failed; contactCosts stays null → fallback values will be used
          console.warn('[useAssistantContactManager] Failed to fetch contact costs:', (result as ResponseProps).detail);
        } else {
          setContactCosts(result as ContactCosts);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[useAssistantContactManager] Error fetching contact costs:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingContactCosts(false);
        }
      }
    }

    loadContactCosts();

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

  // Initialize tab and reset confirmDelete when dialog opens
  // This effect only depends on isOpen and initialTab to avoid resetting the tab
  // when other async data (like allAssistantEmails) loads
  React.useEffect(() => {
    if (isOpen) {
      setConfirmDelete(null);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

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
    }
  }, [isOpen, assistant, allAssistantEmails, setValue]);

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
   * Builds a payload based on the active tab, then calls the dedicated
   * POST /assistant/{id}/contact endpoint to provision the contact.
   */
  const submitContact = React.useCallback(async () => {
    if (isSubmittingContact) return;

    setIsSubmittingContact(true);
    toastIdRef.current = toast.loading('Creating contact...', { id: toastIdRef.current });

    try {
      // Build contact creation payload based on active tab
      const payload: AssistantContactCreatePayload = { contactType: activeTab };

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

          // Extract local part for the backend
          const emailLocal = email.substring(0, email.length - EMAIL_DOMAIN_WITH_AT.length);
          payload.emailLocal = emailLocal;
          payload.firstName = assistant.firstName || '';
          payload.lastName = assistant.surname || '';
          break;
        }

        case 'phone': {
          const phoneCountry = getValues('phoneCountry');
          payload.phoneCountry = phoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE;
          break;
        }

        case 'whatsapp': {
          break;
        }
      }

      // Call the dedicated contact creation endpoint
      const createResult = await assistantActions.contact.create(assistant.agentId, payload);

      if ((createResult as ResponseProps).detail) {
        throw new Error((createResult as ResponseProps).detail);
      }

      toast.success('Contact created successfully!', { id: toastIdRef.current });
      toastIdRef.current = undefined;
      onSuccess();
    } catch (error: any) {
      const errorMessage = error?.message || 'An error occurred while creating contact.';
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
    assistant.firstName,
    assistant.surname,
    assistantActions.contact,
    onSuccess,
  ]);

  // Watch form values for reactive UI updates
  const isEmailAdded = watch('isEmailAdded');

  /**
   * One-time setup cost for the contact type on the active tab.
   * Returns null when costs haven't been fetched yet so the UI can
   * show a generic "setup fee applies" message instead of a wrong number.
   */
  const creationCost = React.useMemo((): number | null => {
    if (contactCosts) {
      return contactCosts[activeTab]?.oneTimeCost ?? 0;
    }
    return null;
  }, [activeTab, contactCosts]);

  /**
   * Estimated monthly cost for the contact type on the active tab.
   * Returns null when costs haven't been fetched yet so the UI can
   * show a generic "monthly fee applies" message instead of a wrong number.
   */
  const monthlyCost = React.useMemo((): number | null => {
    if (contactCosts) {
      return contactCosts[activeTab]?.monthlyCost ?? 0;
    }
    return null;
  }, [activeTab, contactCosts]);

  const isCreateButtonDisabled = React.useMemo(() => {
    if (isSubmittingContact) return true;

    switch (activeTab) {
      case 'email':
        return !isEmailAdded || !emailLocalPart;
      case 'phone':
        return isLoadingPhoneCountries;
      case 'whatsapp':
        return false;
      default:
        return true;
    }
  }, [
    isSubmittingContact,
    activeTab,
    isEmailAdded,
    emailLocalPart,
    isLoadingPhoneCountries,
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
    // Contact costs (fetched from backend)
    contactCosts,
    isLoadingContactCosts,
    // Button states & cost info
    creationCost,
    monthlyCost,
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
  return {
    email: assistant.email || null,
    isEmailAdded: !!assistant.email,
    emailManuallyEdited: !!assistant.email,
    phoneCountry: assistant.phoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE,
    isPhoneNumberAdded: !!assistant.phone,
  };
}
