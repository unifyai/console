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
import {
  buildOAuthCompleteUrl,
  openPendingOAuthTab,
  subscribeOAuthComplete,
} from '@/utils/assistants/oauth';
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
  const grantedFeaturesRequestRef = React.useRef(0);

  const grantedFeaturesResolved = grantedFeatures !== null || !isLoadingFeatures;
  const isByodEmail = !!assistant.email && !!grantedFeatures?.provider;
  const isPlatformEmail =
    !!assistant.email && !isByodEmail && grantedFeaturesResolved && !grantedFeatures?.provider;

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

  // Refetch the assistant's granted features (BYOD provider, scopes, and the
  // connected account email). The response determines whether the email is
  // BYOD (provider non-null) or platform, and drives the feature checklist and
  // file picker. In-flight requests are keyed so overlapping fetches (e.g.
  // OAuth-complete refetch while a prior response is still pending) cannot
  // clear the loading flag early or apply stale results out of order.
  const refetchGrantedFeatures = React.useCallback(async () => {
    if (!assistant.email) return;
    const requestId = ++grantedFeaturesRequestRef.current;
    setIsLoadingFeatures(true);
    try {
      const result = await assistantActions.contact.getGrantedFeatures(assistant.agentId);
      if (requestId !== grantedFeaturesRequestRef.current) return;

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
      if (requestId !== grantedFeaturesRequestRef.current) return;
      console.warn('[useAssistantContactManager] Error fetching granted features:', error);
    } finally {
      if (requestId === grantedFeaturesRequestRef.current) {
        setIsLoadingFeatures(false);
      }
    }
  }, [assistant.email, assistant.agentId, assistantActions.contact]);

  // Drop any cached granted-features snapshot when switching assistants while
  // the dialog stays open.
  React.useEffect(() => {
    setGrantedFeatures(null);
  }, [assistant.agentId]);

  // Fetch granted features when the dialog opens and an email exists.
  React.useEffect(() => {
    if (!isOpen || !assistant.email) return;
    void refetchGrantedFeatures();
    return () => {
      grantedFeaturesRequestRef.current += 1;
    };
  }, [isOpen, assistant.email, refetchGrantedFeatures]);

  // Refetch on OAuth completion so a freshly connected workspace reflects in
  // the modal (feature checklist + file picker) without a manual reopen. This
  // is the only durable refresh signal for a Coordinator, whose own mailbox
  // stays platform-managed — no BYOD email contact is created, so
  // ``assistant.email`` never changes to re-trigger the open effect above.
  // Background refetch: callers keep showing the last snapshot while this runs.
  React.useEffect(() => {
    if (!isOpen) return;
    return subscribeOAuthComplete(() => {
      void refetchGrantedFeatures();
    });
  }, [isOpen, refetchGrantedFeatures]);

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

    // Grab the new tab NOW, synchronously inside the click gesture.
    // The authorize URL is only known after the await below, and
    // ``window.open`` called post-await is blocked by popup blockers
    // (which would force a same-tab redirect and tear down any live
    // call). See openPendingOAuthTab.
    const oauthTab = openPendingOAuthTab();

    setIsConnecting(true);
    const toastId = toast.loading('Preparing connection...');

    try {
      const features =
        selectedFeatures.length > 0 ? selectedFeatures : (REQUIRED_FEATURES[byodProvider] ?? []);

      // Send the provider callback to the bounce page, which closes the
      // new tab and tells this tab to refetch (see openPendingOAuthTab /
      // /oauth/complete).
      const redirectAfter = buildOAuthCompleteUrl();
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
      if (oauthTab.opened) {
        oauthTab.navigate(oauthUrl);
        toast.success('Continue sign-in in the new tab.', { id: toastId });
        setIsConnecting(false);
      } else {
        // Popup blocked — fall back to a same-tab redirect.
        toast.success('Redirecting to sign in...', { id: toastId });
        window.location.href = oauthUrl;
      }
    } catch (error: any) {
      oauthTab.close();
      toast.error(error?.message || 'Failed to start connection.', { id: toastId });
      setIsConnecting(false);
    }
  }, [isConnecting, byodProvider, selectedFeatures, assistant.agentId, assistantActions.contact]);

  const updateFeatures = React.useCallback(async () => {
    if (isConnecting || !grantedFeatures?.provider) return;

    // Open the tab synchronously within the gesture (see connectAccount).
    const oauthTab = openPendingOAuthTab();

    setIsConnecting(true);
    const toastId = toast.loading('Updating features...');

    try {
      const redirectAfter = buildOAuthCompleteUrl();
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
      if (oauthTab.opened) {
        oauthTab.navigate(oauthUrl);
        toast.success('Continue in the new tab to update permissions.', { id: toastId });
        setIsConnecting(false);
      } else {
        toast.success('Redirecting to update permissions...', { id: toastId });
        window.location.href = oauthUrl;
      }
    } catch (error: any) {
      oauthTab.close();
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
  const submitContact = React.useCallback(
    async (contactType: ContactType) => {
      if (isSubmittingContact) return;
      if (
        assistant.isCoordinator &&
        (contactType === 'email' || contactType === 'phone' || contactType === 'whatsapp')
      ) {
        return;
      }

      setIsSubmittingContact(true);
      toastIdRef.current = toast.loading('Creating contact...', { id: toastIdRef.current });

      try {
        const payload: AssistantContactCreatePayload = { contactType };

        switch (contactType) {
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
    },
    [
      isSubmittingContact,
      assistant.isCoordinator,
      getValues,
      assistant.agentId,
      assistantActions.contact,
      onSuccess,
    ]
  );

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  /**
   * One-time setup cost for a given contact type. Returns null when costs
   * haven't been fetched yet so the UI can show a generic "setup fee applies"
   * message instead of a wrong number.
   *
   * Email is always free: platform-issued mailbox provisioning is no longer
   * offered, and BYOD email never incurs charges (the backend levy filters
   * `provisioned_by == "platform"`).
   */
  const getCreationCost = React.useCallback(
    (type: ContactType): number | null => {
      if (type === 'email') return 0;
      if (!contactCosts) return null;
      return contactCosts[type]?.oneTimeCost ?? 0;
    },
    [contactCosts]
  );

  /**
   * Estimated monthly cost for a given contact type. Returns null when costs
   * haven't been fetched yet so the UI can show a generic "monthly fee applies"
   * message instead of a wrong number. Email is always free — see
   * ``getCreationCost`` above.
   */
  const getMonthlyCost = React.useCallback(
    (type: ContactType): number | null => {
      if (type === 'email') return 0;
      if (!contactCosts) return null;
      return contactCosts[type]?.monthlyCost ?? 0;
    },
    [contactCosts]
  );

  const isCreateDisabledFor = React.useCallback(
    (type: ContactType): boolean => {
      if (isSubmittingContact) return true;
      if (
        assistant.isCoordinator &&
        (type === 'email' || type === 'phone' || type === 'whatsapp')
      ) {
        return true;
      }

      switch (type) {
        case 'phone':
          return isLoadingPhoneCountries || !userPhoneNumber;
        case 'whatsapp':
          return !userWhatsappNumber;
        case 'discord':
          return !userDiscordId;
        // Email never shows a Create button — BYOD goes through Connect.
        case 'email':
        default:
          return true;
      }
    },
    [
      isSubmittingContact,
      assistant.isCoordinator,
      isLoadingPhoneCountries,
      userPhoneNumber,
      userWhatsappNumber,
      userDiscordId,
    ]
  );

  const showCreateFor = React.useCallback(
    (type: ContactType): boolean => {
      if (assistant.isCoordinator) return false;
      return (
        (type === 'phone' && !assistant.phone) ||
        (type === 'whatsapp' && !assistant.assistantWhatsappNumber) ||
        (type === 'discord' && !assistant.assistantDiscordBotId)
      );
    },
    [
      assistant.isCoordinator,
      assistant.phone,
      assistant.assistantWhatsappNumber,
      assistant.assistantDiscordBotId,
    ]
  );

  const showDeleteFor = React.useCallback(
    (type: ContactType): boolean => {
      if (assistant.isCoordinator) return false;
      return (
        (type === 'email' && !!isPlatformEmail) ||
        (type === 'phone' && !!assistant.phone) ||
        (type === 'whatsapp' && !!assistant.assistantWhatsappNumber) ||
        (type === 'discord' && !!assistant.assistantDiscordBotId)
      );
    },
    [
      assistant.isCoordinator,
      assistant.phone,
      assistant.assistantWhatsappNumber,
      assistant.assistantDiscordBotId,
      isPlatformEmail,
    ]
  );

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
    // Per-contact-type button states & cost info
    getCreationCost,
    getMonthlyCost,
    isCreateDisabledFor,
    showCreateFor,
    showDeleteFor,
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
