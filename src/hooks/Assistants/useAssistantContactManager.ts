import * as React from 'react';
import { useForm } from 'react-hook-form';
import {
  Assistant,
  AvailableSocialPlatform,
  AvailablePhoneCountry,
  AssistantActions,
  ContactFormData,
} from '@/types/assistants/assistant';
import {
  ContactCosts,
  AssistantContactCreatePayload,
  ContactType,
  OAuthProvider,
  GrantedFeaturesResponse,
} from '@/types/assistants/contact';
import { ResponseProps } from '@/types/common';
import {
  FALLBACK_DEFAULT_COUNTRY_CODE,
  AVAILABLE_FEATURES,
  REQUIRED_FEATURES,
} from '@/constants/assistants/settings';
import { getCountryName, getCountryFlag } from '@/utils/assistants/country-utils';
import { fetchVisitorCountry } from '@/utils/geo';
import { toast } from 'sonner';

interface UseAssistantContactManagerProps {
  assistant: Assistant;
  isOpen: boolean;
  assistantActions: AssistantActions;
  onSuccess: () => void;
  initialTab?: ContactType;
  /** User's phone number from their profile — required to create a phone contact. */
  userPhoneNumber?: string | null;
  /** User's WhatsApp number from their profile — required to create a WhatsApp contact. */
  userWhatsappNumber?: string | null;
  /** User's Discord ID from their profile — required to create a Discord contact. */
  userDiscordId?: string | null;
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
  userPhoneNumber,
  userWhatsappNumber,
  userDiscordId,
}: UseAssistantContactManagerProps) {
  // Create our own form for contact fields
  const contactFormMethods = useForm<ContactFormData>({
    mode: 'onChange',
    defaultValues: getDefaultContactValues(assistant),
  });

  const { setValue, getValues, reset } = contactFormMethods;

  // Phone countries state - fetched when dialog opens
  const [availablePhoneCountries, setAvailablePhoneCountries] = React.useState<
    AvailablePhoneCountry[]
  >([]);
  const [isLoadingPhoneCountries, setIsLoadingPhoneCountries] = React.useState(false);

  // Social platforms state - fetched when dialog opens for WhatsApp tab
  const [availableSocialPlatforms, setAvailableSocialPlatforms] = React.useState<
    AvailableSocialPlatform[]
  >([]);
  const [isLoadingSocialPlatforms, setIsLoadingSocialPlatforms] = React.useState(false);

  // Contact costs state - fetched from the admin billing endpoint
  const [contactCosts, setContactCosts] = React.useState<ContactCosts | null>(null);
  const [isLoadingContactCosts, setIsLoadingContactCosts] = React.useState(false);

  // ---------------------------------------------------------------------------
  // BYOD state (connect your own account).  Email contacts are BYOD-only —
  // platform-issued ``@unify.ai`` mailbox provisioning was retired
  // backend-side and the corresponding UI surface is gone too.
  // ---------------------------------------------------------------------------

  const [byodProvider, setByodProvider] = React.useState<OAuthProvider | null>(null);
  const [selectedFeatures, setSelectedFeatures] = React.useState<string[]>([]);
  const [grantedFeatures, setGrantedFeatures] = React.useState<GrantedFeaturesResponse | null>(
    null
  );
  const [isLoadingFeatures, setIsLoadingFeatures] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  // Determined after granted-features fetch; both false while loading.
  const isByodEmail = !!assistant.email && !!grantedFeatures?.provider;
  const isPlatformEmail = !!assistant.email && !isByodEmail && !isLoadingFeatures;

  // ---------------------------------------------------------------------------
  // Reset form when dialog opens with new assistant data
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (isOpen) {
      reset(getDefaultContactValues(assistant));
      setByodProvider(null);
      setSelectedFeatures([]);
    }
  }, [isOpen, assistant, reset]);

  // ---------------------------------------------------------------------------
  // Data fetching effects
  // ---------------------------------------------------------------------------

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
          console.warn(
            '[useAssistantContactManager] Failed to fetch contact costs:',
            (result as ResponseProps).detail
          );
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

  // Fetch granted features when dialog opens and an email exists.
  // The response determines whether the email is BYOD (provider non-null) or platform.
  React.useEffect(() => {
    if (!isOpen || !assistant.email) return;

    let cancelled = false;

    async function loadGrantedFeatures() {
      setIsLoadingFeatures(true);
      try {
        const result = await assistantActions.contact.getGrantedFeatures(assistant.agentId);
        if (cancelled) return;

        if ('detail' in result) {
          console.warn(
            '[useAssistantContactManager] Failed to fetch granted features:',
            (result as ResponseProps).detail
          );
        } else {
          const feats = result as GrantedFeaturesResponse;
          setGrantedFeatures(feats);
          setSelectedFeatures(feats.features);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[useAssistantContactManager] Error fetching granted features:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingFeatures(false);
        }
      }
    }

    loadGrantedFeatures();

    return () => {
      cancelled = true;
    };
  }, [isOpen, assistant.email, assistant.agentId, assistantActions.contact]);

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------

  const [activeTab, setActiveTab] = React.useState<ContactType>(initialTab || 'email');
  const [confirmDelete, setConfirmDelete] = React.useState<ContactType | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Self-contained submission state
  const [isSubmittingContact, setIsSubmittingContact] = React.useState(false);
  const toastIdRef = React.useRef<string | number | undefined>(undefined);

  // Initialize tab and reset confirmDelete when dialog opens.
  React.useEffect(() => {
    if (isOpen) {
      setConfirmDelete(null);
      setConfirmDisconnect(false);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  // ---------------------------------------------------------------------------
  // BYOD feature toggle
  // ---------------------------------------------------------------------------

  const toggleFeature = React.useCallback(
    (feature: string) => {
      const provider = byodProvider ?? (grantedFeatures?.provider as OAuthProvider | null);
      const required = REQUIRED_FEATURES[provider ?? ''] ?? [];
      if (required.includes(feature)) return;

      setSelectedFeatures((prev) =>
        prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
      );
    },
    [byodProvider, grantedFeatures]
  );

  const availableFeaturesForByod = React.useMemo(() => {
    const provider = byodProvider ?? (grantedFeatures?.provider as OAuthProvider | null);
    return AVAILABLE_FEATURES[provider ?? ''] ?? [];
  }, [byodProvider, grantedFeatures]);

  const requiredFeaturesForByod = React.useMemo(() => {
    const provider = byodProvider ?? (grantedFeatures?.provider as OAuthProvider | null);
    return grantedFeatures?.requiredFeatures ?? REQUIRED_FEATURES[provider ?? ''] ?? [];
  }, [byodProvider, grantedFeatures]);

  const hasFeaturesChanged = React.useMemo(() => {
    if (!grantedFeatures) return false;
    const granted = grantedFeatures.features;
    if (granted.length !== selectedFeatures.length) return true;
    const selectedSet = new Set(selectedFeatures);
    return granted.some((f) => !selectedSet.has(f));
  }, [grantedFeatures, selectedFeatures]);

  // ---------------------------------------------------------------------------
  // BYOD actions
  // ---------------------------------------------------------------------------

  const connectAccount = React.useCallback(async () => {
    if (isConnecting || !byodProvider) return;

    setIsConnecting(true);
    const toastId = toast.loading('Preparing connection...');

    try {
      const features =
        selectedFeatures.length > 0 ? selectedFeatures : (REQUIRED_FEATURES[byodProvider] ?? []);

      const redirectAfter = window.location.href;
      const result = await assistantActions.contact.connect(
        assistant.agentId,
        byodProvider,
        features,
        redirectAfter
      );

      if ('detail' in result) {
        throw new Error((result as ResponseProps).detail);
      }

      const { oauthUrl } = result as { oauthUrl: string };
      toast.success('Redirecting to sign in...', { id: toastId });
      window.location.href = oauthUrl;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start connection.', { id: toastId });
      setIsConnecting(false);
    }
  }, [isConnecting, byodProvider, selectedFeatures, assistant.agentId, assistantActions.contact]);

  const updateFeatures = React.useCallback(async () => {
    if (isConnecting || !grantedFeatures?.provider) return;

    setIsConnecting(true);
    const toastId = toast.loading('Updating features...');

    try {
      const redirectAfter = window.location.href;
      const result = await assistantActions.contact.connect(
        assistant.agentId,
        grantedFeatures.provider as OAuthProvider,
        selectedFeatures,
        redirectAfter
      );

      if ('detail' in result) {
        throw new Error((result as ResponseProps).detail);
      }

      const { oauthUrl } = result as { oauthUrl: string };
      toast.success('Redirecting to update permissions...', { id: toastId });
      window.location.href = oauthUrl;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update features.', { id: toastId });
      setIsConnecting(false);
    }
  }, [
    isConnecting,
    grantedFeatures,
    selectedFeatures,
    assistant.agentId,
    assistantActions.contact,
  ]);

  const disconnectAccount = React.useCallback(async () => {
    if (isDisconnecting) return;

    setIsDisconnecting(true);
    const toastId = toast.loading('Disconnecting account...');

    try {
      const result = await assistantActions.contact.disconnect(assistant.agentId);

      if (result.detail && !result.info) {
        throw new Error(result.detail);
      }

      toast.success('Account disconnected.', { id: toastId });
      setConfirmDisconnect(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to disconnect.', { id: toastId });
    } finally {
      setIsDisconnecting(false);
    }
  }, [isDisconnecting, assistant.agentId, assistantActions.contact, onSuccess]);

  // Initialize default features when byodProvider changes
  React.useEffect(() => {
    if (byodProvider) {
      setSelectedFeatures(REQUIRED_FEATURES[byodProvider] ?? []);
    }
  }, [byodProvider]);

  // ---------------------------------------------------------------------------
  // Delete / submit (platform provisioning)
  // ---------------------------------------------------------------------------

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
      onSuccess();
    } catch (error: any) {
      toast.error(`Failed to delete contact. Please try again.`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Self-contained contact submission for non-email contact types.
   * Builds a payload based on the active tab, then calls the dedicated
   * POST /assistant/{id}/contact endpoint to provision the contact.
   *
   * Email contacts are BYOD-only and go through ``connectAccount`` (OAuth
   * redirect), not this handler — the create button is hidden on the
   * email tab.
   */
  const submitContact = React.useCallback(async () => {
    if (isSubmittingContact) return;

    setIsSubmittingContact(true);
    toastIdRef.current = toast.loading('Creating contact...', { id: toastIdRef.current });

    try {
      const payload: AssistantContactCreatePayload = { contactType: activeTab };

      switch (activeTab) {
        case 'phone': {
          const phoneCountry = getValues('phoneCountry');
          payload.phoneCountry = phoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE;
          break;
        }

        case 'whatsapp':
        case 'discord':
          break;

        case 'email':
          throw new Error('Email contacts are BYOD-only — use the OAuth Connect flow instead.');
      }

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
    assistantActions.contact,
    onSuccess,
  ]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  /**
   * One-time setup cost for the contact type on the active tab.
   * Returns null when costs haven't been fetched yet so the UI can
   * show a generic "setup fee applies" message instead of a wrong number.
   *
   * Email is always free: platform-issued mailbox provisioning is no longer
   * offered, and BYOD email never incurs charges (the backend levy filters
   * `provisioned_by == "platform"`).
   */
  const creationCost = React.useMemo((): number | null => {
    if (activeTab === 'email') return 0;
    if (!contactCosts) return null;
    return contactCosts[activeTab]?.oneTimeCost ?? 0;
  }, [activeTab, contactCosts]);

  /**
   * Estimated monthly cost for the contact type on the active tab.
   * Returns null when costs haven't been fetched yet so the UI can
   * show a generic "monthly fee applies" message instead of a wrong number.
   *
   * Email is always free — see ``creationCost`` above.
   */
  const monthlyCost = React.useMemo((): number | null => {
    if (activeTab === 'email') return 0;
    if (!contactCosts) return null;
    return contactCosts[activeTab]?.monthlyCost ?? 0;
  }, [activeTab, contactCosts]);

  const isCreateButtonDisabled = React.useMemo(() => {
    if (isSubmittingContact) return true;

    switch (activeTab) {
      case 'phone':
        return isLoadingPhoneCountries || !userPhoneNumber;
      case 'whatsapp':
        return !userWhatsappNumber;
      case 'discord':
        return !userDiscordId;
      // Email tab never shows a Create button — BYOD goes through Connect.
      case 'email':
      default:
        return true;
    }
  }, [
    isSubmittingContact,
    activeTab,
    isLoadingPhoneCountries,
    userPhoneNumber,
    userWhatsappNumber,
    userDiscordId,
  ]);

  const showCreateButton =
    (activeTab === 'phone' && !assistant.phone) ||
    (activeTab === 'whatsapp' && !assistant.assistantWhatsappNumber) ||
    (activeTab === 'discord' && !assistant.assistantDiscordBotId);

  const showDeleteButton =
    (activeTab === 'email' && !!isPlatformEmail) ||
    (activeTab === 'phone' && !!assistant.phone) ||
    (activeTab === 'whatsapp' && !!assistant.assistantWhatsappNumber) ||
    (activeTab === 'discord' && !!assistant.assistantDiscordBotId);

  return {
    // Form methods for component bindings
    contactFormMethods,
    // Tab state
    activeTab,
    setActiveTab,
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
    isByodEmail: !!isByodEmail,
    isPlatformEmail: !!isPlatformEmail,
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

function getDefaultContactValues(assistant: Assistant): ContactFormData {
  return {
    email: assistant.email || null,
    isEmailAdded: !!assistant.email,
    emailManuallyEdited: !!assistant.email,
    phoneCountry: assistant.phoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE,
    isPhoneNumberAdded: !!assistant.phone,
  };
}
