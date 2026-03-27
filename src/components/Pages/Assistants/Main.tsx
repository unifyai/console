'use client';

import * as React from 'react';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import { LiveActionsViewer } from '@/components/Pages/Assistants/LiveActions';
import {
  Assistant,
  AssistantActions,
  AssistantFormData,
  AssistantPreset,
  AssistantUpdatePayload,
  VoiceOption,
} from '@/types/assistants/assistant';
import { toast } from 'sonner';
import { AssistantProfilePanel } from './Profile/AssistantProfile';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantHire } from './Hire/AssistantHire';
import { AssistantEdit } from './Edit/AssistantEdit';
import { HireForm } from '@/components/Pages/Assistants/Hire/AssistantHireForm';
import { PresetsPanel } from './Hire/Presets/AssistantHirePresetsList';
import { useAssistants } from '@/hooks/Assistants/useAssistants';
import { useAssistantPresets } from '@/hooks/Assistants/useAssistantPresets';
import { useAssistantForm } from '@/hooks/Assistants/useAssistantForm';
import { usePanelManager } from '@/hooks/Assistants/usePanelManager';
import { useCreditGrantLink } from '@/hooks/Billing/useCreditGrantLink';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';
import { useBillingEvents } from '@/hooks/Billing/useBillingEvents';
import { AssistantsBanners } from './AssistantsBanners';
import { StripeSidePanel } from '@/components/Billing/StripeSidePanel';
import { useAssistantStatus } from '@/hooks/Assistants/useAssistantStatus';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { FormProvider } from 'react-hook-form';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import { getLangCodeForNationality } from '@/utils/assistants/voice-utils';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage } from '@/types/assistants/chat';
import { AssistantHireLocalSetupInstructionsDialog } from './Hire/AssistantHireLocalSetupInstructions';
import { AssistantContactManager } from './Profile/AssistantContactManager';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import { useContactIdPrefetch } from '@/hooks/Assistants/useContactIdPrefetch';
import { LogLevel, Room, setLogLevel } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { AssistantCommunicationDialog } from './Communication/AssistantCommunicationDialog';
import { useUserSpending } from '@/hooks/User/useUserSpending';
import { useOrgSpending } from '@/hooks/Organizations/useOrgSpending';
import { useSearchParams } from 'next/navigation';
import { useSpendingGate } from '@/hooks/Assistants/useSpendingGate';
import { SpendingDisplayProps } from '@/types/assistants/spending';
import { useAssistantSystemErrors } from '@/hooks/Assistants/useAssistantSystemErrors';
import { seedMediaSignedUrls } from '@/lib/client/assistant';

interface MainProps {
  assistantActions: AssistantActions;
  userMeta: {
    image: string | null | undefined;
    timezone?: string | null;
    email?: string | null;
    orgId?: number | null;
    isOrgContext?: boolean;
    mfaSetupRequired?: boolean;
  };
}

function isSignedMediaUrl(url: string | null | undefined): url is string {
  return Boolean(url && (url.startsWith('https://') || url.startsWith('http://')));
}

export default function Main({ assistantActions, userMeta }: MainProps) {
  // --- UI Panel Management ---
  const { profileAssistantId, isProfileOpen, handleShowProfile, handleProfileClose } =
    usePanelManager();

  // --- Assistant List Fold / Resize State ---
  const LIST_SNAP_THRESHOLD = 150;
  const LIST_DEFAULT_WIDTH = 240;
  const LIST_MIN_WIDTH = 56;
  const LIST_MAX_WIDTH = 500;

  // --- Profile Panel Sizing (60:40 default split with Actions) ---
  const PROFILE_PANEL_RATIO = 0.5;
  const PROFILE_MIN_WIDTH = 300;
  const PROFILE_MAX_RATIO = 0.8;
  const RESIZE_HANDLE_WIDTH = 3;

  const contentContainerRef = React.useRef<HTMLDivElement>(null);

  const getAvailableContentWidth = React.useCallback(() => {
    const container = contentContainerRef.current;
    if (!container) return 0;
    const listEl = container.firstElementChild as HTMLElement | null;
    const listW = listEl ? listEl.offsetWidth : 0;
    return container.offsetWidth - listW - RESIZE_HANDLE_WIDTH * 2;
  }, []);

  const [profilePanelWidth, setProfilePanelWidth] = React.useState(500);
  const [isResizingProfile, setIsResizingProfile] = React.useState(false);
  const profileRatioRef = React.useRef(PROFILE_PANEL_RATIO);
  const hasSetInitialProfileWidth = React.useRef(false);

  React.useEffect(() => {
    if (!isProfileOpen || hasSetInitialProfileWidth.current) return;
    const available = getAvailableContentWidth();
    if (available > 0) {
      const target = Math.round(available * PROFILE_PANEL_RATIO);
      setProfilePanelWidth(Math.max(PROFILE_MIN_WIDTH, target));
      profileRatioRef.current = PROFILE_PANEL_RATIO;
      hasSetInitialProfileWidth.current = true;
    }
  }, [isProfileOpen, getAvailableContentWidth]);

  React.useEffect(() => {
    if (!isProfileOpen) {
      hasSetInitialProfileWidth.current = false;
    }
  }, [isProfileOpen]);

  React.useEffect(() => {
    if (!isProfileOpen || isResizingProfile) return;
    const container = contentContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const available = getAvailableContentWidth();
      if (available > 0) {
        const target = Math.round(available * profileRatioRef.current);
        setProfilePanelWidth(
          Math.max(PROFILE_MIN_WIDTH, Math.min(target, Math.round(available * PROFILE_MAX_RATIO)))
        );
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [isProfileOpen, isResizingProfile, getAvailableContentWidth]);

  const handleProfileResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingProfile(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startWidth = profilePanelWidth;
      const startX = e.clientX;
      const available = getAvailableContentWidth();
      const maxWidth = Math.round(available * PROFILE_MAX_RATIO);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        if (newWidth >= PROFILE_MIN_WIDTH && newWidth <= maxWidth) {
          setProfilePanelWidth(newWidth);
          if (available > 0) profileRatioRef.current = newWidth / available;
        }
      };

      const handleMouseUp = () => {
        setIsResizingProfile(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [profilePanelWidth, getAvailableContentWidth]
  );

  const [assistantListWidth, setAssistantListWidth] = React.useState(LIST_DEFAULT_WIDTH);
  const [isAssistantListFolded, setIsAssistantListFolded] = React.useState(false);
  const [isResizingList, setIsResizingList] = React.useState(false);
  const preSnapWidthRef = React.useRef(LIST_DEFAULT_WIDTH);

  const handleListResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingList(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startX = e.clientX;
      const startWidth = isAssistantListFolded ? LIST_MIN_WIDTH : assistantListWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);

        if (newWidth < LIST_SNAP_THRESHOLD) {
          // Snap to folded
          if (!isAssistantListFolded) {
            preSnapWidthRef.current = startWidth;
          }
          setIsAssistantListFolded(true);
          setAssistantListWidth(LIST_MIN_WIDTH);
        } else {
          // Expanded mode
          setIsAssistantListFolded(false);
          const clampedWidth = Math.min(LIST_MAX_WIDTH, Math.max(LIST_SNAP_THRESHOLD, newWidth));
          setAssistantListWidth(clampedWidth);
        }
      };

      const handleMouseUp = () => {
        setIsResizingList(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [assistantListWidth, isAssistantListFolded]
  );

  // --- Assistant Data & Actions ---
  const {
    assistants,
    setAssistants,
    isLoading: isLoadingAssistants,
    error: assistantError,
    refreshAssistants,
    deleteAssistant,
    updateAssistantProfile,
  } = useAssistants(assistantActions, !!userMeta.isOrgContext);

  // --- Deep-link to a specific assistant via ?profile=<agentId> ---
  const searchParams = useSearchParams();
  const profileParam = searchParams.get('profile');
  const hasOpenedDeepLink = React.useRef(false);
  React.useEffect(() => {
    if (profileParam && assistants.length > 0 && !hasOpenedDeepLink.current) {
      const match = assistants.find((a) => a.agentId === profileParam);
      if (match) {
        hasOpenedDeepLink.current = true;
        handleShowProfile(match.agentId);
      }
    }
  }, [profileParam, assistants, handleShowProfile]);

  // --- Assistant Status Polling ---
  const { statuses: assistantStatuses, markOnline: markAssistantOnline } =
    useAssistantStatus(assistants);

  // --- Assistant Permissions ---
  const { canHire, canWrite, canDelete } = useAssistantPermissions();

  // --- Billing Status & Credit Grant Link ---
  const {
    credits,
    accountStatus,
    isLoading: isBillingLoading,
    refetch: refetchBillingStatus,
    startPolling: startBillingPolling,
  } = useBillingStatus();
  useBillingEvents();
  const { pendingToken, claimPendingToken } = useCreditGrantLink();
  const [isStripePanelOpen, setIsStripePanelOpen] = React.useState(false);

  // --- Dialogs & Forms ---
  const [isHireDialogOpen, setIsHireDialogOpen] = React.useState(false);
  const [assistantToEdit, setAssistantToEdit] = React.useState<Assistant | null>(null);
  const [contactManagerAssistant, setContactManagerAssistant] = React.useState<Assistant | null>(
    null
  );
  const [contactManagerInitialTab, setContactManagerInitialTab] = React.useState<
    'email' | 'phone' | 'whatsapp'
  >('email');
  const [isAssistantPresetsOpen, setIsAssistantPresetsOpen] = React.useState(true);
  const [isDialogBusyProcessingPhoto, setIsDialogBusyProcessingPhoto] = React.useState(false);
  const [isDialogBusyProcessingVoice, setIsDialogBusyProcessingVoice] = React.useState(false);
  const [newlyHiredInfo, setNewlyHiredInfo] = React.useState<{
    assistant: Assistant;
    preHireChat?: ChatMessage[];
  } | null>(null);
  const [profileChatHistories, setProfileChatHistories] = React.useState<
    Record<string, ChatMessage[]>
  >({});

  // --- Prefetch contact IDs AND transcripts for all loaded assistants ---
  // Resolves contact IDs and fetches transcript history in the background as
  // soon as the assistant list is available. Contact IDs go into sessionStorage;
  // transcripts go directly into profileChatHistories (write-if-absent).
  // When the user opens a chat, both are already cached — the chat loads
  // instantly with zero loading/skeleton state.
  useContactIdPrefetch(assistants, assistantActions, userMeta.email, setProfileChatHistories);

  const [setupInstructions, setSetupInstructions] = React.useState<{
    os: string;
    isOpen: boolean;
  } | null>(null);
  const [popOutCallAssistantId, setPopOutCallAssistantId] = React.useState<string | null>(null);

  const pongTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pongListenerRef = React.useRef<(event: StorageEvent) => void>();

  const verifyAndSetPopOutState = React.useCallback(() => {
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
    if (pongListenerRef.current) window.removeEventListener('storage', pongListenerRef.current);
    setPopOutCallAssistantId(null);

    try {
      const data = localStorage.getItem('activePopOutCall');
      if (!data) return;

      const popOutData = JSON.parse(data);
      const pingId = `ping-${Date.now()}`;

      pongListenerRef.current = (event: StorageEvent) => {
        if (event.key === 'popOutCallPong' && event.newValue === pingId) {
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          window.removeEventListener('storage', pongListenerRef.current!);
          setPopOutCallAssistantId(popOutData?.assistantId || null);
        }
      };

      window.addEventListener('storage', pongListenerRef.current);
      localStorage.setItem('popOutCallPing', pingId);
      setTimeout(() => localStorage.removeItem('popOutCallPing'), 2000);

      pongTimeoutRef.current = setTimeout(() => {
        window.removeEventListener('storage', pongListenerRef.current!);
        console.warn(
          "No response from pop-out call window. Clearing stale 'activePopOutCall' localStorage entry."
        );
        localStorage.removeItem('activePopOutCall');
        setPopOutCallAssistantId(null);
      }, 1500);
    } catch (e) {
      console.error('Error during pop-out verification, clearing state:', e);
      localStorage.removeItem('activePopOutCall');
      setPopOutCallAssistantId(null);
    }
  }, []);

  React.useEffect(() => {
    verifyAndSetPopOutState();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'activePopOutCall') {
        verifyAndSetPopOutState();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
      if (pongListenerRef.current) window.removeEventListener('storage', pongListenerRef.current);
    };
  }, [verifyAndSetPopOutState]);

  // --- Call Management ---
  const room = React.useMemo(() => {
    setLogLevel(LogLevel.warn);
    return new Room();
  }, []);
  const {
    isConnecting: isConnectingCall,
    isConnected: isCallConnected,
    activeCallAssistant,
    callType,
    connectionDetails,
    connect: startCall,
    disconnect: hangUpCall,
    isSpeakerMuted,
    toggleSpeakerMute,
    isWaitingForAssistant,
    waitingMessage,
    connectionError,
    retryConnection,
    isDesktopReady,
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isRemoteControlInteractive,
    isRemoteControlInteractiveLoading,
    toggleRemoteControlInteractive,
  } = useAssistantCall(room, assistantActions);
  const [isCommunicationDialogOpen, setIsCommunicationDialogOpen] = React.useState(false);

  // --- User/Org Spending for Spending Gate ---
  // Stable disabled action functions (defined once, never changes)
  const disabledAction = React.useCallback(async () => ({ detail: 'disabled' }) as const, []);

  // User spending (personal workspace or member spending)
  const userSpendingConfig = React.useMemo(
    () => ({
      setLimitAction: disabledAction,
      enablePolling: true,
    }),
    [disabledAction]
  );

  const userSpendingData = useUserSpending(userSpendingConfig);

  // Org spending (only in org context)
  const orgSpendingConfig = React.useMemo(() => {
    if (!userMeta.orgId) {
      return {
        orgId: 0,
        setLimitAction: disabledAction,
        enablePolling: false,
      };
    }
    return {
      orgId: userMeta.orgId,
      setLimitAction: disabledAction,
      enablePolling: true,
    };
  }, [userMeta.orgId, disabledAction]);

  const orgSpendingData = useOrgSpending(orgSpendingConfig);

  // Track assistant spending display for currently selected profile assistant
  // This will be set by the AssistantProfilePanel when it loads spending data
  const [profileAssistantSpending, setProfileAssistantSpending] =
    React.useState<SpendingDisplayProps | null>(null);

  // Compute spending gate status
  // Check enablePolling to determine if spending data is actually enabled
  const isUserSpendingEnabled = userSpendingConfig.enablePolling;
  const isOrgSpendingEnabled = orgSpendingConfig.enablePolling;

  const spendingGateStatus = useSpendingGate({
    assistantSpending: profileAssistantSpending,
    userSpending: isUserSpendingEnabled ? userSpendingData.display : null,
    orgSpending: isOrgSpendingEnabled ? orgSpendingData.display : null,
    isLoading:
      (isUserSpendingEnabled ? userSpendingData.isLoading : false) ||
      (isOrgSpendingEnabled ? orgSpendingData.isLoading : false),
    isRefreshing:
      (isUserSpendingEnabled ? userSpendingData.isRefreshing : false) ||
      (isOrgSpendingEnabled ? orgSpendingData.isRefreshing : false),
    credits,
    isBillingLoading,
  });

  // Reset assistant spending when profile changes
  React.useEffect(() => {
    setProfileAssistantSpending(null);
  }, [profileAssistantId]);

  const handleStartCall = React.useCallback(
    async (assistant: Assistant, callType: 'video' | 'audio') => {
      const activeCallId = activeCallAssistant?.agentId || popOutCallAssistantId;
      if (activeCallId) {
        if (activeCallId === assistant.agentId) {
          if (popOutCallAssistantId) {
            toast.info(
              'Call is active in a separate tab. Close that tab to start a new call here.'
            );
          } else {
            setIsCommunicationDialogOpen(true);
          }
        } else {
          toast.info('A call is already in progress with another assistant.');
        }
        return;
      }

      setIsCommunicationDialogOpen(true);
      await startCall(assistant, callType);
    },
    [startCall, activeCallAssistant, popOutCallAssistantId]
  );

  const handleHangUp = React.useCallback(async () => {
    await hangUpCall();
    setIsCommunicationDialogOpen(false);
  }, [hangUpCall]);

  // Close dialog if connection fails during setup or is disconnected remotely
  React.useEffect(() => {
    if (connectionError) return; // Don't close if there's an error the user needs to see

    if (!isConnectingCall && !isCallConnected && isCommunicationDialogOpen) {
      setIsCommunicationDialogOpen(false);
    }
  }, [isConnectingCall, isCallConnected, isCommunicationDialogOpen, connectionError]);

  const {
    displayedPresets,
    loadMorePresets,
    canLoadMorePresets,
    isLoadingMorePresets,
    presetAgeFilter,
    setPresetAgeFilter,
    presetNationalityFilter,
    setPresetNationalityFilter,
    presetGenderFilter,
    setPresetGenderFilter,
    presetLanguageFilter,
    setPresetLanguageFilter,
    availableAgeBrackets,
    availableNationalities,
    availableGenders,
    availableLanguages,
    currentFilteredPresets,
    allAssistantPresets,
    presetPhotoUrls,
  } = useAssistantPresets({ enabled: isHireDialogOpen });

  // --- Voice Management Options ---
  const [justDeletedVoiceId, setJustDeletedVoiceId] = React.useState<string | null>(null);
  // Lazy load voices only when hire/edit dialogs are open
  const shouldLoadVoices = isHireDialogOpen || !!assistantToEdit;
  const {
    allDisplayableVoices: unsortedVoices,
    isLoadingUserVoices,
    fetchUserVoices,
    deleteUserVoice,
  } = useVoiceOptions(assistantActions.voice, { enabled: shouldLoadVoices });

  const handleFirstViewCompleted = React.useCallback(() => setNewlyHiredInfo(null), []);

  // --- Callbacks for form success ---
  const handleHireSuccess = React.useCallback(
    (newAssistant: Assistant, formData: AssistantFormData, preHireChat?: ChatMessage[]) => {
      const optimisticSignedUrlsByPath: Record<string, string> = {};
      const optimisticSignedPatch: Partial<
        Pick<Assistant, 'signedProfilePhotoUrl' | 'signedProfileVideoUrl'>
      > = {};

      const registerOptimisticSignedUrl = (
        mediaPath: string | null | undefined,
        signedUrl: string | null | undefined,
        field: 'signedProfilePhotoUrl' | 'signedProfileVideoUrl'
      ) => {
        if (!mediaPath || !isSignedMediaUrl(signedUrl)) return;
        optimisticSignedUrlsByPath[mediaPath] = signedUrl;
        optimisticSignedPatch[field] = signedUrl;
      };

      registerOptimisticSignedUrl(
        newAssistant.profilePhoto,
        newAssistant.signedProfilePhotoUrl,
        'signedProfilePhotoUrl'
      );
      registerOptimisticSignedUrl(
        newAssistant.profileVideo,
        newAssistant.signedProfileVideoUrl,
        'signedProfileVideoUrl'
      );
      registerOptimisticSignedUrl(
        formData.profilePhotoUrl,
        formData.photoPreviewUrl,
        'signedProfilePhotoUrl'
      );
      registerOptimisticSignedUrl(
        formData.profileVideoUrl,
        formData.videoPreviewUrl,
        'signedProfileVideoUrl'
      );

      if (Object.keys(optimisticSignedUrlsByPath).length > 0) {
        seedMediaSignedUrls(optimisticSignedUrlsByPath);
      }

      const optimisticAssistant: Assistant = {
        ...newAssistant,
        ...(formData.profilePhotoUrl && !newAssistant.profilePhoto
          ? { profilePhoto: formData.profilePhotoUrl }
          : {}),
        ...(formData.profileVideoUrl && !newAssistant.profileVideo
          ? { profileVideo: formData.profileVideoUrl }
          : {}),
        ...optimisticSignedPatch,
      };

      setIsHireDialogOpen(false);
      setAssistants((currentAssistants) => {
        const existingAssistant = currentAssistants.find(
          (assistant) => assistant.agentId === optimisticAssistant.agentId
        );
        if (!existingAssistant) {
          return [optimisticAssistant, ...currentAssistants];
        }
        return currentAssistants.map((assistant) =>
          assistant.agentId === optimisticAssistant.agentId
            ? { ...assistant, ...optimisticAssistant }
            : assistant
        );
      });
      setNewlyHiredInfo({ assistant: optimisticAssistant, preHireChat });
      handleShowProfile(optimisticAssistant.agentId);
      if (formData.setup === 'local' && formData.operatingSystem) {
        setSetupInstructions({ os: formData.operatingSystem, isOpen: true });
      }

      refreshAssistants(false);
      fetchUserVoices();
      refetchBillingStatus();
    },
    [refreshAssistants, handleShowProfile, refetchBillingStatus, fetchUserVoices, setAssistants]
  );

  const handleUpdateSuccess = React.useCallback(
    (updatedPayload?: Partial<AssistantUpdatePayload>) => {
      refreshAssistants(false);
      setAssistantToEdit(null);
      setContactManagerAssistant(null);
      // Note: desktopMode is set at creation time only and cannot be updated,
      // so we no longer show setup instructions on update
    },
    [refreshAssistants]
  );

  // --- Combined Hire/Edit Form Hook ---
  const {
    formMethods,
    initiateHireSequence,
    isCheckingBalance,
    isSubmitting: isFormSubmitting,
    showInsufficientFundsHint,
    setShowInsufficientFundsHint,
    selectPreset: selectPresetForHireForm,
    resetForm: resetHireFormInternal,
    loadAssistantForEdit,
    initiateUpdate,
    onNewMediaReady,
  } = useAssistantForm(
    assistantActions,
    unsortedVoices,
    handleHireSuccess,
    handleUpdateSuccess,
    isHireDialogOpen || !!assistantToEdit || !!contactManagerAssistant
  );

  // --- Voice Options  ---
  const hireFormNationality = formMethods.watch('nationality');
  const preferredLanguage = React.useMemo(
    () => getLangCodeForNationality(hireFormNationality),
    [hireFormNationality]
  );
  const allDisplayableVoices = React.useMemo(() => {
    const filteredByProvider = unsortedVoices.filter((v) => v.provider !== 'openai');

    const sorted = [...filteredByProvider];
    sorted.sort((a, b) => {
      const isAPreferred = preferredLanguage && a.language === preferredLanguage;
      const isBPreferred = preferredLanguage && b.language === preferredLanguage;
      if (isAPreferred && !isBPreferred) return -1;
      if (!isAPreferred && isBPreferred) return 1;
      if (!a.isPreset && b.isPreset) return -1;
      if (a.isPreset && !b.isPreset) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    return sorted;
  }, [unsortedVoices, preferredLanguage]);

  // --- Callbacks for UI interaction ---
  // Track whether we need to auto-select a preset when presets become available
  const [needsPresetSelection, setNeedsPresetSelection] = React.useState(false);
  const [userHasChangedPreset, setUserHasChangedPreset] = React.useState(false);

  const handleOpenHireDialog = React.useCallback(() => {
    resetHireFormInternal();
    setIsAssistantPresetsOpen(true);
    setPresetAgeFilter('all');
    setPresetNationalityFilter('all');
    setPresetGenderFilter('all');
    setPresetLanguageFilter('all');
    setIsDialogBusyProcessingVoice(false);

    // Mark that we need to select a preset once they're loaded
    setNeedsPresetSelection(true);
    setUserHasChangedPreset(false);

    // Open the dialog - this triggers lazy loading of presets
    setIsHireDialogOpen(true);
  }, [
    resetHireFormInternal,
    setPresetAgeFilter,
    setPresetNationalityFilter,
    setPresetGenderFilter,
    setPresetLanguageFilter,
  ]);

  // Auto-select the first filtered preset (top of the "Available Hires" list)
  // whenever the filtered list changes (e.g. the async geo lookup narrows by
  // region) — but only while the dialog is freshly opened and the user hasn't
  // manually picked a preset yet.
  // If a preset is already selected and still exists in the new filtered list
  // (e.g. after geo narrows the list), skip re-selection to avoid a visual
  // "reload" where photos/videos are cleared and re-fetched.
  React.useEffect(() => {
    if (needsPresetSelection && currentFilteredPresets.length > 0 && !userHasChangedPreset) {
      const current = formMethods.getValues('currentPreset');
      if (
        current &&
        currentFilteredPresets.some(
          (p) => p.firstName === current.firstName && p.surname === current.surname
        )
      ) {
        return; // already selected and still valid — nothing to do
      }
      selectPresetForHireForm(currentFilteredPresets[0]);
    }
  }, [
    needsPresetSelection,
    currentFilteredPresets,
    userHasChangedPreset,
    selectPresetForHireForm,
    formMethods,
  ]);

  const handleOpenEditDialog = React.useCallback(
    (assistant: Assistant) => {
      loadAssistantForEdit(assistant);
      setAssistantToEdit(assistant);
    },
    [loadAssistantForEdit]
  );

  const handleOpenContactManager = (
    assistant: Assistant,
    tab: 'email' | 'phone' | 'whatsapp' = 'email'
  ) => {
    loadAssistantForEdit(assistant);
    setContactManagerInitialTab(tab);
    setContactManagerAssistant(assistant);
  };

  const handleRandomizePreset = () => {
    if (currentFilteredPresets.length === 0) {
      toast.info('No presets match filters.');
      return;
    }
    setUserHasChangedPreset(true);
    const randomIndex = Math.floor(Math.random() * currentFilteredPresets.length);
    selectPresetForHireForm(currentFilteredPresets[randomIndex]);
  };

  const handleUserPresetSelect = React.useCallback(
    (preset: AssistantPreset) => {
      setUserHasChangedPreset(true);
      selectPresetForHireForm(preset);
    },
    [selectPresetForHireForm]
  );

  const handleDeleteVoice = async (voice: VoiceOption) => {
    const deletedId = await deleteUserVoice(voice);
    if (deletedId) {
      setJustDeletedVoiceId(deletedId); // Set state to trigger the effect
    }
  };

  // Profile Panel Actions
  const onDeleteAssistantSubmit = async (assistant: Assistant) => {
    const success = await deleteAssistant(assistant);
    if (success) {
      handleProfileClose();
    } else {
      throw new Error('Deletion failed in hook.');
    }
  };

  // --- Effects ---
  const initialAssistantLoadProcessedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isBillingLoading && !isLoadingAssistants && !initialAssistantLoadProcessedRef.current) {
      initialAssistantLoadProcessedRef.current = true;
      // Don't auto-open the hire dialog when:
      // - MFA setup is required (the MFA enforcement modal needs focus)
      // - The user doesn't have hire permission (org members/admins can't hire)
      if (
        !assistantError &&
        assistants.length === 0 &&
        !isHireDialogOpen &&
        !userMeta.mfaSetupRequired &&
        canHire
      ) {
        handleOpenHireDialog();
      }
    }
  }, [
    assistants,
    isLoadingAssistants,
    assistantError,
    handleOpenHireDialog,
    isBillingLoading,
    isHireDialogOpen,
    userMeta.mfaSetupRequired,
    canHire,
  ]);
  React.useEffect(() => {
    if (justDeletedVoiceId) {
      const { getValues, setValue } = formMethods;
      if (getValues('voiceId') === justDeletedVoiceId) {
        setValue('voiceId', null as any);
        setValue('voiceName', '');
        setValue('voiceDescription', '');
        setValue('voiceGender', 'female');
        setValue('voiceLanguage', 'en');
        setValue('voiceProvider', PRIMARY_VOICE_PROVIDER);
        setValue('voiceExists', false);
      }
      setJustDeletedVoiceId(null); // Reset the trigger
    }
  }, [justDeletedVoiceId, formMethods]);

  // --- Memoized values for props ---
  const profileAssistant = React.useMemo(
    () => assistants.find((a) => a.agentId === profileAssistantId) || null,
    [assistants, profileAssistantId]
  );
  const activeCallId = activeCallAssistant?.agentId || popOutCallAssistantId;

  // --- System error listener (assistant-level, above all interaction surfaces) ---
  useAssistantSystemErrors(profileAssistant);

  // Determine active panel for width calculations
  const isFirstViewAfterHire = newlyHiredInfo?.assistant.agentId === profileAssistantId;
  const computedListWidth = isAssistantListFolded ? LIST_MIN_WIDTH : assistantListWidth;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AssistantsBanners
        credits={credits}
        isBillingLoading={isBillingLoading}
        spendingGateStatus={spendingGateStatus}
        isOrgWorkspace={!!userMeta.orgId}
        accountStatus={accountStatus}
      />

      {/* StripeSidePanel — for adding payment method */}
      <StripeSidePanel
        open={isStripePanelOpen}
        onOpenChange={setIsStripePanelOpen}
        onSuccess={() => {
          // Kick off aggressive polling (every 2 s) to bridge the gap
          // between Stripe confirming payment and the webhook crediting
          // the balance.  Polling auto-stops once credits appear or
          // after 30 s.
          refetchBillingStatus();
          startBillingPolling();
          // Auto-claim pending credit grant token after payment method added
          if (pendingToken) {
            claimPendingToken();
          }
        }}
        pendingCreditToken={pendingToken}
      />

      <div ref={contentContainerRef} className="flex min-h-0 flex-1 overflow-hidden bg-background">
        {/* Assistant List */}
        <div
          className="relative h-full flex-shrink-0 border-r"
          style={{
            width: computedListWidth,
            transition: isResizingList ? 'none' : 'width 0.3s ease-in-out',
          }}
        >
          <AssistantList
            assistants={assistants}
            assistantStatuses={assistantStatuses}
            assistantError={assistantError}
            isLoading={isLoadingAssistants}
            error={assistantError}
            profileAssistantId={profileAssistantId}
            onShowProfile={handleShowProfile}
            onOpenHireDialog={handleOpenHireDialog}
            onOpenContactManager={handleOpenContactManager}
            isFolded={isAssistantListFolded}
            activeCallAssistantId={activeCallId}
            onHangUp={handleHangUp}
            canHire={canHire}
          />
        </div>
        {/* List resize handle */}
        <div
          onMouseDown={handleListResizeStart}
          className="hover:bg-primary/20 active:bg-primary/40 -ml-1.5 h-full w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors duration-200"
          style={{ zIndex: 20 }}
        />

        {/* Assistant Profile Panel */}
        <AnimatePresence initial={false}>
          {isProfileOpen &&
            profileAssistant && [
              <motion.div
                key="assistant-profile"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: profilePanelWidth, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{
                  type: 'tween',
                  ease: 'easeInOut',
                  duration: isResizingProfile ? 0 : 0.3,
                }}
                className="h-full flex-shrink-0 overflow-hidden border-r bg-background"
              >
                <AssistantProfilePanel
                  assistant={profileAssistant}
                  assistantActions={assistantActions}
                  onClose={handleProfileClose}
                  onEdit={handleOpenEditDialog}
                  onOpenContactManager={handleOpenContactManager}
                  chatHistories={profileChatHistories}
                  setChatHistories={setProfileChatHistories}
                  userEmail={userMeta.email}
                  isFirstView={isFirstViewAfterHire}
                  preHireChat={isFirstViewAfterHire ? newlyHiredInfo.preHireChat : undefined}
                  onFirstViewCompleted={handleFirstViewCompleted}
                  onStartCall={handleStartCall}
                  activeCallAssistantId={activeCallId}
                  isCallConnected={isCallConnected}
                  isConnectingCall={isConnectingCall}
                  userTimezone={userMeta.timezone}
                  canWrite={canWrite(profileAssistant)}
                  spendingGate={spendingGateStatus}
                  onAssistantSpendingChange={setProfileAssistantSpending}
                  onAssistantReply={markAssistantOnline}
                  onAssistantUpdated={(id, patch) => {
                    setAssistants((prev) =>
                      prev.map((a) => (a.agentId === id ? { ...a, ...patch } : a))
                    );
                  }}
                />
              </motion.div>,
              <motion.div
                key="profile-resize-handle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onMouseDown={handleProfileResizeStart}
                className="hover:bg-primary/20 active:bg-primary/40 -ml-1.5 h-full w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors duration-200"
                style={{ zIndex: 20 }}
              />,
            ]}
        </AnimatePresence>

        {/* Live Actions Viewer */}
        <div className="relative h-full min-w-0 flex-1 overflow-hidden bg-background">
          <LiveActionsViewer
            assistant={profileAssistant}
            actions={assistantActions.actions || null}
          />
        </div>
      </div>

      {/* Dialogs and Overlays */}
      <FormProvider {...formMethods}>
        <AssistantHire
          formMethods={formMethods}
          isHireDialogOpen={isHireDialogOpen}
          isHireSubmitting={isFormSubmitting}
          setIsHireDialogOpen={setIsHireDialogOpen}
          isAssistantPresetsOpen={isAssistantPresetsOpen}
          setIsAssistantPresetsOpen={setIsAssistantPresetsOpen}
          handleRandomizePreset={handleRandomizePreset}
          currentFilteredPresets={currentFilteredPresets}
          onHireAttempt={initiateHireSequence}
          isProcessingPhoto={isDialogBusyProcessingPhoto}
          isProcessingVoice={isDialogBusyProcessingVoice}
          isCheckingBalance={isCheckingBalance}
          showInsufficientFundsHint={showInsufficientFundsHint}
          setShowInsufficientFundsHint={setShowInsufficientFundsHint}
          onAddPaymentMethod={() => setIsStripePanelOpen(true)}
          isStripePanelOpen={isStripePanelOpen}
        >
          <HireForm
            formMethods={formMethods}
            isSubmitting={isFormSubmitting}
            assistantActions={assistantActions}
            onPhotoProcessingStateChange={setIsDialogBusyProcessingPhoto}
            onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice}
            allDisplayableVoices={allDisplayableVoices}
            isLoadingUserVoices={isLoadingUserVoices}
            fetchUserVoices={fetchUserVoices}
            handleDeleteVoice={handleDeleteVoice}
            onNewMediaReady={onNewMediaReady}
            mode="hire"
            onAddPaymentMethod={() => setIsStripePanelOpen(true)}
            userHasChangedPreset={userHasChangedPreset}
          />
          <PresetsPanel
            displayedPresets={displayedPresets}
            onPresetSelect={handleUserPresetSelect}
            onClose={() => setIsAssistantPresetsOpen(false)}
            onLoadMore={loadMorePresets}
            canLoadMore={canLoadMorePresets}
            isLoadingMore={isLoadingMorePresets}
            ageFilter={presetAgeFilter}
            onAgeFilterChange={setPresetAgeFilter}
            availableAgeBrackets={availableAgeBrackets}
            nationalityFilter={presetNationalityFilter}
            onNationalityFilterChange={setPresetNationalityFilter}
            availableNationalities={availableNationalities}
            genderFilter={presetGenderFilter}
            onGenderFilterChange={setPresetGenderFilter}
            availableGenders={availableGenders}
            languageFilter={presetLanguageFilter}
            onLanguageFilterChange={setPresetLanguageFilter}
            availableLanguages={availableLanguages}
            layoutMode="split" // Dummy prop
            setLayoutMode={() => {}} // Dummy prop
            presetPhotoUrls={presetPhotoUrls}
          />
        </AssistantHire>

        {assistantToEdit && (
          <AssistantEdit
            isOpen={!!assistantToEdit}
            onClose={() => setAssistantToEdit(null)}
            assistant={assistantToEdit}
            formMethods={formMethods}
            onSubmit={initiateUpdate}
            isSubmitting={isFormSubmitting}
            isProcessingPhoto={isDialogBusyProcessingPhoto}
            isProcessingVoice={isDialogBusyProcessingVoice}
            onAddPaymentMethod={() => setIsStripePanelOpen(true)}
            isStripePanelOpen={isStripePanelOpen}
            onDeleteAssistant={onDeleteAssistantSubmit}
            canDelete={canDelete(assistantToEdit)}
          >
            <HireForm
              formMethods={formMethods}
              onSubmit={initiateUpdate}
              isSubmitting={isFormSubmitting}
              assistantActions={assistantActions}
              onPhotoProcessingStateChange={setIsDialogBusyProcessingPhoto}
              onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice}
              allDisplayableVoices={allDisplayableVoices}
              isLoadingUserVoices={isLoadingUserVoices}
              fetchUserVoices={fetchUserVoices}
              handleDeleteVoice={handleDeleteVoice}
              onNewMediaReady={onNewMediaReady}
              mode="edit"
              onAddPaymentMethod={() => setIsStripePanelOpen(true)}
            />
          </AssistantEdit>
        )}
        {contactManagerAssistant && (
          <AssistantContactManager
            isOpen={!!contactManagerAssistant}
            onClose={() => setContactManagerAssistant(null)}
            assistant={contactManagerAssistant}
            assistantActions={assistantActions}
            onSuccess={handleUpdateSuccess}
            initialTab={contactManagerInitialTab}
            canWrite={canWrite(contactManagerAssistant)}
            onAddPaymentMethod={() => setIsStripePanelOpen(true)}
          />
        )}
      </FormProvider>

      <AssistantHireLocalSetupInstructionsDialog
        isOpen={setupInstructions?.isOpen || false}
        os={setupInstructions?.os || 'ubuntu'}
        onClose={() => setSetupInstructions(null)}
      />

      {activeCallAssistant && (
        <RoomContext.Provider value={room}>
          <AssistantCommunicationDialog
            isOpen={isCommunicationDialogOpen}
            onClose={handleHangUp}
            assistant={activeCallAssistant}
            assistantActions={assistantActions}
            room={room}
            chatHistories={profileChatHistories}
            setChatHistories={setProfileChatHistories}
            isConnecting={isConnectingCall}
            userEmail={userMeta.email}
            userImage={userMeta.image}
            isWaitingForAssistant={isWaitingForAssistant}
            waitingMessage={waitingMessage}
            isCallConnected={isCallConnected}
            connectionError={connectionError}
            onRetry={retryConnection}
            isRemoteControlActive={isRemoteControlActive}
            liveviewUrl={liveviewUrl}
            isRemoteControlLoading={isRemoteControlLoading}
            toggleRemoteControl={toggleRemoteControl}
            isRemoteControlInteractive={isRemoteControlInteractive}
            isRemoteControlInteractiveLoading={isRemoteControlInteractiveLoading}
            toggleRemoteControlInteractive={toggleRemoteControlInteractive}
            isDesktopReady={isDesktopReady}
            callType={callType}
            isSpeakerMuted={isSpeakerMuted}
            onToggleSpeaker={toggleSpeakerMute}
          />
        </RoomContext.Provider>
      )}
    </div>
  );
}
