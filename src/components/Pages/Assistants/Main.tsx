'use client';

import * as React from 'react';
import { AssistantList } from '@/components/Pages/Assistants/Assistants/List/AssistantList';
import { LiveActionsViewer } from '@/components/Pages/Assistants/LiveActions';
import {
  Assistant,
  AssistantActions,
  AssistantPreset,
  AssistantUpdatePayload,
  VoiceOption,
} from '@/types/assistants/assistant';
import { TaskActions } from '@/types/assistants/task';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { AssistantProfilePanel } from './Assistants/Profile/AssistantProfile';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantHire } from './Assistants/Hire/AssistantHire';
import { AssistantEdit } from './Assistants/Edit/AssistantEdit';
import { HireForm } from '@/components/Pages/Assistants/Assistants/Hire/AssistantHireForm';
import { PresetsPanel } from './Assistants/Hire/Presets/AssistantHirePresetsList';
import { useAssistants } from '@/hooks/Assistants/useAssistants';
import { useAssistantPresets } from '@/hooks/Assistants/useAssistantPresets';
import { useAssistantForm } from '@/hooks/Assistants/useAssistantForm';
import { usePanelManager } from '@/hooks/Assistants/usePanelManager';
import { useCreditGrantLink } from '@/hooks/Billing/useCreditGrantLink';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';
import { AssistantsBanners } from './AssistantsBanners';
import { StripeSidePanel } from '@/components/Billing/StripeSidePanel';
import { useAssistantStatus } from '@/hooks/Assistants/useAssistantStatus';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { FormProvider } from 'react-hook-form';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import { getLangCodeForNationality } from '@/utils/assistants/voice-utils';
import {
  PRIMARY_VOICE_PROVIDER,
  ASSISTANT_HIRE_COMPLETION_DELAY_MS,
} from '@/constants/assistants/settings';
import { ChatMessage } from '@/types/assistants/chat';
import { AssistantHireLocalSetupInstructionsDialog } from './Assistants/Hire/AssistantHireLocalSetupInstructions';
import { AssistantContactManager } from './Assistants/Profile/AssistantContactManager';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import { LogLevel, Room, setLogLevel } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { AssistantCommunicationDialog } from './Communication/AssistantCommunicationDialog';
import { useUserSpending } from '@/hooks/User/useUserSpending';
import { useOrgSpending } from '@/hooks/Organizations/useOrgSpending';
import { useSearchParams } from 'next/navigation';
import { useSpendingGate } from '@/hooks/Assistants/useSpendingGate';
import { SpendingDisplayProps } from '@/types/assistants/spending';

interface MainProps {
  taskActions: TaskActions;
  assistantActions: AssistantActions;
  oneTimeToken?: string | null;
  userMeta: {
    image: string | null | undefined;
    timezone?: string | null;
    email?: string | null;
    orgId?: number | null;
    mfaSetupRequired?: boolean;
  };
}

export default function Main({ taskActions, assistantActions, oneTimeToken, userMeta }: MainProps) {
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
  } = useAssistants(assistantActions);

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
  const { statuses: assistantStatuses } = useAssistantStatus(
    assistants,
    assistantActions.assistant.status
  );

  // --- Assistant Permissions ---
  const { canHire, canWrite, canDelete } = useAssistantPermissions();

  // --- Billing Status & Credit Grant Link ---
  const {
    hasCustomerId,
    hasCredits,
    isLoading: isBillingLoading,
    refetch: refetchBillingStatus,
  } = useBillingStatus();
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
  const userSpendingConfig = React.useMemo(() => {
    if (!assistantActions.userSpending) {
      return {
        getSpendAction: disabledAction,
        getLimitAction: disabledAction,
        setLimitAction: disabledAction,
        enablePolling: false,
      };
    }
    return {
      getSpendAction: assistantActions.userSpending.getSpend,
      getLimitAction: assistantActions.userSpending.getLimit,
      setLimitAction: disabledAction,
      enablePolling: true,
    };
  }, [assistantActions.userSpending, disabledAction]);

  const userSpendingData = useUserSpending(userSpendingConfig);

  // Org spending (only in org context)
  const orgSpendingConfig = React.useMemo(() => {
    if (!assistantActions.orgSpending || !userMeta.orgId) {
      return {
        orgId: 0,
        getSpendAction: disabledAction,
        getLimitAction: disabledAction,
        setLimitAction: disabledAction,
        enablePolling: false,
      };
    }
    const orgId = userMeta.orgId;
    return {
      orgId,
      getSpendAction: assistantActions.orgSpending.getSpend,
      getLimitAction: assistantActions.orgSpending.getLimit,
      setLimitAction: disabledAction,
      enablePolling: true,
    };
  }, [assistantActions.orgSpending, userMeta.orgId, disabledAction]);

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
    (newAssistant: Assistant, formData: any, preHireChat?: ChatMessage[]) => {
      refreshAssistants(false);
      fetchUserVoices();
      refetchBillingStatus();

      // Delay closing form and opening profile to allow user to see completion state
      setTimeout(() => {
        setIsHireDialogOpen(false);
        setNewlyHiredInfo({ assistant: newAssistant, preHireChat });
        handleShowProfile(newAssistant.agentId);
        if (formData.setup === 'local' && formData.operatingSystem) {
          setSetupInstructions({ os: formData.operatingSystem, isOpen: true });
        }
      }, ASSISTANT_HIRE_COMPLETION_DELAY_MS);
    },
    [refreshAssistants, handleShowProfile, refetchBillingStatus, fetchUserVoices]
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
  // manually picked a preset yet. needsPresetSelection is intentionally NOT
  // cleared here so the effect re-fires when the geo lookup resolves.
  React.useEffect(() => {
    if (needsPresetSelection && currentFilteredPresets.length > 0 && !userHasChangedPreset) {
      selectPresetForHireForm(currentFilteredPresets[0]);
    }
  }, [needsPresetSelection, currentFilteredPresets, userHasChangedPreset, selectPresetForHireForm]);

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

  // Determine active panel for width calculations
  const isFirstViewAfterHire = newlyHiredInfo?.assistant.agentId === profileAssistantId;
  const computedListWidth = isAssistantListFolded ? LIST_MIN_WIDTH : assistantListWidth;

  return (
    <>
      <Toaster richColors position="bottom-right" closeButton />

      <AssistantsBanners
        hasCredits={hasCredits}
        hasCustomerId={hasCustomerId}
        isBillingLoading={isBillingLoading}
        spendingGateStatus={spendingGateStatus}
        isOrgWorkspace={!!userMeta.orgId}
      />

      {/* StripeSidePanel — for adding payment method */}
      <StripeSidePanel
        open={isStripePanelOpen}
        onOpenChange={setIsStripePanelOpen}
        onSuccess={() => {
          refetchBillingStatus();
          // Auto-claim pending credit grant token after payment method added
          if (pendingToken) {
            claimPendingToken();
          }
        }}
        pendingCreditToken={pendingToken}
      />

      <div ref={contentContainerRef} className="flex h-full overflow-hidden bg-background">
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
            assistants={assistants}
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
              assistants={assistants}
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
    </>
  );
}
