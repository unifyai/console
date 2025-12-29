'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Pages/Assistants/Assistants/List/AssistantList";
import { TaskList } from "@/components/Pages/Assistants/Tasks/List/TaskList";
import { cn } from '@/lib/utils';
import { Assistant, AssistantActions, AssistantPreset, AssistantUpdatePayload, AvailableSocialPlatform, VoiceOption } from '@/types/assistants/assistant';
import { TaskActions, Status as TaskStatusEnum } from '@/types/assistants/task';
import { toast } from "sonner";
import { Toaster } from "sonner";
import { AssistantProfilePanel } from './Assistants/Profile/AssistantProfile';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantHire } from './Assistants/Hire/AssistantHire';
import { AssistantEdit } from './Assistants/Edit/AssistantEdit';
import { HireForm } from '@/components/Pages/Assistants/Assistants/Hire/AssistantHireForm';
import { PresetsPanel } from './Assistants/Hire/Presets/AssistantHirePresetsList';
import { useAssistants } from '@/hooks/Assistants/useAssistants';
import { useTaskFilters } from '@/hooks/Assistants/useTaskFilters';
import { useTasks } from '@/hooks/Assistants/useTasks';
import { useAssistantPresets } from '@/hooks/Assistants/useAssistantPresets';
import { useAssistantHireForm } from '@/hooks/Assistants/useAssistantHireForm';
import { usePanelManager } from '@/hooks/Assistants/usePanelManager';
import { useAssistantHiringApproval } from '@/hooks/Assistants/useAssistantHiringApproval';
import { useAssistantStatus } from '@/hooks/Assistants/useAssistantStatus';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { FormProvider } from 'react-hook-form';
import { ResponseProps } from '@/types/common';
import { useVoiceOptions } from '@/hooks/Assistants/useVoiceOptions';
import { getLangCodeForNationality } from '@/utils/assistants/voice-utils';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage } from '@/types/assistants/chat';
import { AssistantHireLocalSetupInstructionsDialog } from './Assistants/Hire/AssistantHireLocalSetupInstructions';
import { AssistantContactManager } from './Assistants/Profile/AssistantContactManager';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import { Room } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { AssistantCommunicationDialog } from './Communication/AssistantCommunicationDialog';
import { AssistantCommunicationMinimized } from './Communication/AssistantCommunicationMinimized';


interface MainProps {
    taskActions: TaskActions;
    assistantActions: AssistantActions;
    oneTimeToken?: string | null;
    userMeta: { image: string | null | undefined; timezone?: string | null; };
}

export default function Main({
    taskActions, 
    assistantActions, 
    oneTimeToken,
    userMeta,
}: MainProps) {
    // --- UI Panel Management ---
    const {
        profileAssistantId, isProfileOpen,
        handleShowProfile, handleProfileClose,
    } = usePanelManager();

    const [profilePanelWidth, setProfilePanelWidth] = React.useState(350);
    const [isResizingProfile, setIsResizingProfile] = React.useState(false);

    const handleProfileResizeStart = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingProfile(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const startWidth = profilePanelWidth;
        const startX = e.clientX;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            const minWidth = 300;
            const maxWidth = 800;
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setProfilePanelWidth(newWidth);
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
    }, [profilePanelWidth]);


    // --- Assistant List Fold State ---
    const [isAssistantListFolded, setIsAssistantListFolded] = React.useState(false);

    // --- Assistant Data & Actions ---
    const {
        assistants,
        isLoading: isLoadingAssistants,
        error: assistantError,
        refreshAssistants,
        deleteAssistant,
        updateAssistantProfile,
    } = useAssistants(assistantActions); 

    // --- Assistant Status Polling ---
    const { statuses: assistantStatuses } = useAssistantStatus(
        assistants,
        assistantActions.assistant.status
    );

    // --- Assistant Permissions ---
    const { canHire, canWrite, canDelete } = useAssistantPermissions();

    // --- Task Filters & Data ---
    const {
        searchTermInput, setSearchTermInput,
        statusFilter, setStatusFilter,
        priorityFilter, setPriorityFilter,
        deadlineFilter, setDeadlineFilter,
        assistantFilter, setAssistantFilter,
        filterExpression,
    } = useTaskFilters();

    const [initialTaskFetchTriggered, setInitialTaskFetchTriggered] = React.useState(true);

    const {
        tasks, fetchMoreTasks, hasMoreTasks, isLoadingMore: isLoadingMoreTasks,
        isLoadingInitial: isLoadingInitialTasks, initialLoadError: taskLoadError,
        updateLocalTask,
    } = useTasks(taskActions, assistants, assistantFilter, filterExpression, initialTaskFetchTriggered);

    const availableTaskStatuses = React.useMemo(() => {
        return ['all', ...Object.values(TaskStatusEnum)];
    }, []);

    // --- Assistant Hiring Approval ---
    const {
        approvalStatus: userHiringApprovalStatus,
        isLoading: isLoadingHiringApproval,
        isProcessingAction: isProcessingHiringAction,
        requestAccess: requestHiringAccess,
        refreshHiringProfile,
    } = useAssistantHiringApproval({
        approvalActions: assistantActions["approval"],
        tokenToClaimOnLoad: oneTimeToken,
    });


    // --- Dialogs & Forms ---
    const [isHireDialogOpen, setIsHireDialogOpen] = React.useState(false);
    const [assistantToEdit, setAssistantToEdit] = React.useState<Assistant | null>(null);
    const [contactManagerAssistant, setContactManagerAssistant] = React.useState<Assistant | null>(null);
    const [contactManagerInitialTab, setContactManagerInitialTab] = React.useState<'email' | 'phone' | 'whatsapp'>('email');
    const [isAssistantPresetsOpen, setIsAssistantPresetsOpen] = React.useState(true);
    const [isDialogBusyProcessingPhoto, setIsDialogBusyProcessingPhoto] = React.useState(false);
    const [isDialogBusyProcessingVoice, setIsDialogBusyProcessingVoice] = React.useState(false); 
    const [newlyHiredInfo, setNewlyHiredInfo] = React.useState<{ assistant: Assistant; preHireChat?: ChatMessage[] } | null>(null);
    const [profileChatHistories, setProfileChatHistories] = React.useState<Record<string, ChatMessage[]>>({});
    const [setupInstructions, setSetupInstructions] = React.useState<{ os: string; isOpen: boolean } | null>(null);
    const [availableSocialPlatforms, setAvailableSocialPlatforms] = React.useState<AvailableSocialPlatform[]>([]);
    const [isLoadingSocialPlatforms, setIsLoadingSocialPlatforms] = React.useState(true);
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
                console.warn("No response from pop-out call window. Clearing stale 'activePopOutCall' localStorage entry.");
                localStorage.removeItem('activePopOutCall');
                setPopOutCallAssistantId(null);
            }, 1500);

        } catch (e) {
            console.error("Error during pop-out verification, clearing state:", e);
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
    const room = React.useMemo(() => new Room(), []);
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
        connectionError,
        retryConnection,
        isRemoteControlActive,
        liveviewUrl,
        isRemoteControlLoading,
        toggleRemoteControl,
        isRemoteControlInteractive,
        toggleRemoteControlInteractive,
    } = useAssistantCall(room, assistantActions);
    const [isCommunicationDialogOpen, setIsCommunicationDialogOpen] = React.useState(false);
    const [isCallMinimized, setIsCallMinimized] = React.useState(false);

    const handleStartCall = React.useCallback(async (assistant: Assistant, callType: 'video' | 'audio') => {
        const activeCallId = activeCallAssistant?.agent_id || popOutCallAssistantId;
        if (activeCallId) {
            if (activeCallId === assistant.agent_id) {
                if (popOutCallAssistantId) {
                    toast.info("Call is active in a separate tab. Close that tab to start a new call here.");
                } else {
                    setIsCommunicationDialogOpen(true);
                    setIsCallMinimized(false);
                }
            } else {
                toast.info("A call is already in progress with another assistant.");
            }
            return;
        }

        setIsCommunicationDialogOpen(true);
        setIsCallMinimized(false);
        await startCall(assistant, callType);
    }, [isCallConnected, isConnectingCall, startCall, activeCallAssistant, popOutCallAssistantId]);

    const handleHangUp = React.useCallback(async () => {
        await hangUpCall();
        setIsCommunicationDialogOpen(false);
        setIsCallMinimized(false);
    }, [hangUpCall]);

    const handleMinimizeCall = React.useCallback(() => {
        setIsCommunicationDialogOpen(false);
        setIsCallMinimized(true);
    }, []);
    
    const handleExpandCall = React.useCallback(() => {
        if (activeCallAssistant) {
            setIsCommunicationDialogOpen(true);
            setIsCallMinimized(false);
        }
    }, [activeCallAssistant]);

    // Close dialog if connection fails during setup or is disconnected remotely
    React.useEffect(() => {
        if (connectionError) return; // Don't close if there's an error the user needs to see

        if (!isConnectingCall && !isCallConnected && (isCommunicationDialogOpen || isCallMinimized)) {
            setIsCommunicationDialogOpen(false);
            setIsCallMinimized(false);
        }
    }, [isConnectingCall, isCallConnected, isCommunicationDialogOpen, isCallMinimized, connectionError]);

    React.useEffect(() => {
        setIsLoadingSocialPlatforms(true);
        assistantActions.contact.listAvailableSocialPlatforms()
            .then(result => {
                if (Array.isArray(result)) {
                    setAvailableSocialPlatforms(result as AvailableSocialPlatform[]);
                } else {
                    const backendError = (result as ResponseProps).detail || "Could not fetch social platforms.";
                    console.error("[Main.tsx] Error fetching social platforms:", backendError);
                    toast.error("Failed to fetch social platforms.");
                    setAvailableSocialPlatforms([]);
                }
            })
            .catch(err => {
                console.error("[Main.tsx] An unexpected error occurred while fetching social platforms:", err);
                toast.error("Failed to fetch social platforms.");
                setAvailableSocialPlatforms([]);
            })
            .finally(() => {
                setIsLoadingSocialPlatforms(false);
            });
    }, [assistantActions.contact]);

    const {
        displayedPresets, loadMorePresets, canLoadMorePresets, isLoadingMorePresets,
        presetAgeFilter, setPresetAgeFilter,
        presetNationalityFilter, setPresetNationalityFilter,
        presetGenderFilter, setPresetGenderFilter,
        presetLanguageFilter, setPresetLanguageFilter,
        availableAgeBrackets, availableNationalities, availableGenders,
        availableLanguages,
        currentFilteredPresets, allAssistantPresets
    } = useAssistantPresets();

    // --- Voice Management Options ---
    const [justDeletedVoiceId, setJustDeletedVoiceId] = React.useState<string | null>(null);
    const {
        allDisplayableVoices: unsortedVoices,
        isLoadingUserVoices,
        fetchUserVoices,
        deleteUserVoice
    } = useVoiceOptions(assistantActions.voice);
    
    // --- Callbacks for form success ---
    const handleHireSuccess = React.useCallback((newAssistant: Assistant, formData: any, preHireChat?: ChatMessage[]) => {
        refreshAssistants(false);
        fetchUserVoices();
        setIsHireDialogOpen(false);
        setNewlyHiredInfo({ assistant: newAssistant, preHireChat }); // Set the newly hired info
        handleShowProfile(newAssistant.agent_id);
        refreshHiringProfile();
        if (formData.setup === 'local' && formData.operating_system) {
            setSetupInstructions({ os: formData.operating_system, isOpen: true });
        }
    }, [refreshAssistants, handleShowProfile, refreshHiringProfile, fetchUserVoices]);

    const handleUpdateSuccess = React.useCallback((updatedPayload?: Partial<AssistantUpdatePayload>) => {
        refreshAssistants(false);
        setAssistantToEdit(null);
        setContactManagerAssistant(null);
        if (updatedPayload?.user_local_desktop) {
            setSetupInstructions({ os: updatedPayload.user_local_desktop, isOpen: true });
        }
    }, [refreshAssistants]);
    
    // --- Combined Hire/Edit Form Hook ---
    const {
        hireFormMethods,
        initiateHireSequence,
        isCheckingBalance,
        isSubmitting: isFormSubmitting,
        showInsufficientFundsHint,
        setShowInsufficientFundsHint,
        selectPreset: selectPresetForHireForm,
        resetForm: resetHireFormInternal,
        loadAssistantForEdit,
        initiateUpdate,
        fetchedAssistantEmails,
        isLoadingEmails,
        availablePhoneCountries,
        isLoadingCountries,
        onNewMediaReady,
    } = useAssistantHireForm(assistantActions, unsortedVoices, handleHireSuccess, handleUpdateSuccess, isHireDialogOpen || !!assistantToEdit || !!contactManagerAssistant);
    
    // --- Voice Options  ---
    const hireFormNationality = hireFormMethods.watch("nationality");
    const hireFormFastMode = hireFormMethods.watch("fast_mode") as boolean;
    const preferredLanguage = React.useMemo(() => getLangCodeForNationality(hireFormNationality), [hireFormNationality]);
    const allDisplayableVoices = React.useMemo(() => {
        const voicesToFilter = unsortedVoices;
        const filteredByProvider = hireFormFastMode
            ? voicesToFilter.filter(v => v.provider === 'openai')
            : voicesToFilter.filter(v => v.provider !== 'openai');
        
        const sorted = [...filteredByProvider];
        sorted.sort((a, b) => {
            const isAPreferred = preferredLanguage && a.language === preferredLanguage;
            const isBPreferred = preferredLanguage && b.language === preferredLanguage;
            if (isAPreferred && !isBPreferred) return -1;
            if (!isAPreferred && isBPreferred) return 1;
            if (!a.is_preset && b.is_preset) return -1;
            if (a.is_preset && !b.is_preset) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
        return sorted;
    }, [unsortedVoices, preferredLanguage, hireFormFastMode]);    

    // --- Callbacks for UI interaction ---
    const handleOpenHireDialog = React.useCallback(() => {
        resetHireFormInternal();
        setIsAssistantPresetsOpen(true);
        setPresetAgeFilter('all');
        setPresetNationalityFilter('all');
        setPresetGenderFilter('all');
        setPresetLanguageFilter('all');
        setIsDialogBusyProcessingVoice(false);

        let presetsToUse = currentFilteredPresets.length > 0 ? currentFilteredPresets : (allAssistantPresets as AssistantPreset[]);
        if (presetsToUse.length > 0) {
            const randomIndex = Math.floor(Math.random() * presetsToUse.length);
            selectPresetForHireForm(presetsToUse[randomIndex]);
        }

        // Then, open the dialog. It will initially show its own loading state.
        setIsHireDialogOpen(true);
        refreshHiringProfile();

    }, [resetHireFormInternal, currentFilteredPresets, selectPresetForHireForm, setPresetAgeFilter, setPresetNationalityFilter, setPresetGenderFilter, setPresetLanguageFilter, refreshHiringProfile]);

    const handleOpenEditDialog = React.useCallback((assistant: Assistant) => {
        loadAssistantForEdit(assistant);
        setAssistantToEdit(assistant);
    }, [loadAssistantForEdit]);
    
    const handleOpenContactManager = (assistant: Assistant, tab: 'email' | 'phone' | 'whatsapp' = 'email') => {
        loadAssistantForEdit(assistant);
        setContactManagerInitialTab(tab);
        setContactManagerAssistant(assistant);
    };

    const handleRandomizePreset = () => {
        if (currentFilteredPresets.length === 0) {
            toast.info("No presets match filters.");
            return;
        }
        const randomIndex = Math.floor(Math.random() * currentFilteredPresets.length);
        selectPresetForHireForm(currentFilteredPresets[randomIndex]);
    };
    
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
            throw new Error("Deletion failed in hook.");
        }
    };
    
    // --- Effects ---
    const initialAssistantLoadProcessedRef = React.useRef(false);
    React.useEffect(() => {
        if (userHiringApprovalStatus === "approved" && !isLoadingAssistants && !initialAssistantLoadProcessedRef.current) {
            initialAssistantLoadProcessedRef.current = true;
            if (!assistantError && assistants.length === 0 && !isLoadingEmails && !isHireDialogOpen) { 
                handleOpenHireDialog();
            }
        }
    }, [ assistants, isLoadingAssistants, assistantError, handleOpenHireDialog, isLoadingEmails, userHiringApprovalStatus, isHireDialogOpen ]);
    React.useEffect(() => {
        if (justDeletedVoiceId) {
            const { getValues, setValue } = hireFormMethods;
            if (getValues("voice_id") === justDeletedVoiceId) {
                setValue("voice_id", null as any); 
                setValue("voice_name", "");
                setValue("voice_description", "");
                setValue("voice_gender", "female");
                setValue("voice_language", "en"); 
                setValue("voice_provider", PRIMARY_VOICE_PROVIDER);
                setValue("voice_exists", false);
            }
            setJustDeletedVoiceId(null); // Reset the trigger
        }
    }, [justDeletedVoiceId, hireFormMethods]);

    // --- Memoized values for props ---
    const profileAssistant = React.useMemo(() => assistants.find(a => a.agent_id === profileAssistantId) || null, [assistants, profileAssistantId]);
    const isCombinedLoadingInitial = initialTaskFetchTriggered && isLoadingInitialTasks;
    const activeCallId = activeCallAssistant?.agent_id || popOutCallAssistantId;
    
    // Determine active panel for width calculations
    const isFirstViewAfterHire = newlyHiredInfo?.assistant.agent_id === profileAssistantId;
    const activeSidePanelCount = (isProfileOpen ? 1 : 0);
    const assistantListWidth = isAssistantListFolded ? "w-12"
                             : activeSidePanelCount === 1 ? "w-1/3 lg:w-[300px] xl:w-[350px]" 
                             : "w-1/3 lg:w-[400px] xl:w-[450px]"; 

    return (
        <>
            <Toaster richColors position="bottom-right" closeButton />

            <div className="flex h-full bg-background overflow-hidden">
                {/* Assistant List */}
                <div className={cn("h-full transition-all duration-300 ease-in-out relative border-r", assistantListWidth, "flex-shrink-0")}>
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
                        onToggleFold={() => setIsAssistantListFolded(prev => !prev)}
                        activeCallAssistantId={activeCallId}
                        onHangUp={handleHangUp}
                        canHire={canHire}
                    />
                </div>

                {/* Assistant Profile Panel */}
                <AnimatePresence initial={false}>
                    {isProfileOpen && profileAssistant && [
                        <motion.div
                            key="assistant-profile"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: profilePanelWidth, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{
                                type: "tween",
                                ease: "easeInOut",
                                duration: isResizingProfile ? 0 : 0.3
                            }}
                            className="h-full flex-shrink-0 border-r overflow-hidden bg-background"
                        >
                            <AssistantProfilePanel
                                assistant={profileAssistant}
                                assistantActions={assistantActions}
                                onClose={handleProfileClose}
                                onDeleteAssistant={onDeleteAssistantSubmit}
                                onEdit={handleOpenEditDialog}
                                onOpenContactManager={handleOpenContactManager}
                                chatHistories={profileChatHistories}
                                setChatHistories={setProfileChatHistories}
                                isFirstView={isFirstViewAfterHire}
                                preHireChat={isFirstViewAfterHire ? newlyHiredInfo.preHireChat : undefined}
                                onFirstViewCompleted={() => setNewlyHiredInfo(null)}
                                onStartCall={handleStartCall}
                                activeCallAssistantId={activeCallId}
                                isCallConnected={isCallConnected}
                                isConnectingCall={isConnectingCall}
                                userTimezone={userMeta.timezone}
                                canWrite={canWrite(profileAssistant)}
                                canDelete={canDelete(profileAssistant)}
                            />
                        </motion.div>,
                        <motion.div
                            key="profile-resize-handle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onMouseDown={handleProfileResizeStart}
                            className="w-1.5 h-full cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/40 transition-colors duration-200 flex-shrink-0"
                            style={{ zIndex: 20 }}
                        />
                    ]}
                </AnimatePresence>

                {/* Task List */}
                <div className="flex-1 h-full min-w-0 overflow-hidden relative">
                    <TaskList
                        tasks={tasks}
                        fetchMoreTasks={fetchMoreTasks}
                        hasMoreTasks={hasMoreTasks}
                        isLoadingMore={isLoadingMoreTasks}
                        isLoadingInitial={isCombinedLoadingInitial}
                        initialLoadError={taskLoadError}
                        searchTerm={searchTermInput}
                        setSearchTerm={setSearchTermInput}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        priorityFilter={priorityFilter}
                        setPriorityFilter={setPriorityFilter}
                        deadlineFilter={deadlineFilter}
                        setDeadlineFilter={setDeadlineFilter}
                        updateTask={taskActions.update}
                        onTaskUpdate={updateLocalTask}
                        availableStatuses={availableTaskStatuses}
                        assistants={assistants}
                        assistantFilter={assistantFilter}
                        setAssistantFilter={setAssistantFilter}
                        canWriteAssistant={canWrite}
                    />
                </div>
            </div>

            {/* Dialogs and Overlays */}
            <FormProvider {...hireFormMethods}>
                <AssistantHire
                    formMethods={hireFormMethods}
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
                    userApprovalStatus={userHiringApprovalStatus}
                    isLoadingUserApproval={isLoadingHiringApproval || isProcessingHiringAction}
                    onRequestAccess={requestHiringAccess}
                    isFastMode={hireFormFastMode}
                >
                    <HireForm
                        assistants={assistants}
                        formMethods={hireFormMethods}
                        isSubmitting={isFormSubmitting || isLoadingEmails}
                        assistantActions={assistantActions}
                        onPhotoProcessingStateChange={setIsDialogBusyProcessingPhoto}
                        onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice} 
                        allDisplayableVoices={allDisplayableVoices}
                        isLoadingUserVoices={isLoadingUserVoices}
                        fetchUserVoices={fetchUserVoices}
                        handleDeleteVoice={handleDeleteVoice}
                        onNewMediaReady={onNewMediaReady}
                        mode="hire"
                    />
                    <PresetsPanel                                    
                        displayedPresets={displayedPresets}
                        onPresetSelect={selectPresetForHireForm}
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
                        isFastMode={hireFormFastMode}
                        layoutMode="split" // Dummy prop
                        setLayoutMode={() => {}} // Dummy prop
                    />
                </AssistantHire>

                {assistantToEdit && (
                    <AssistantEdit
                        isOpen={!!assistantToEdit}
                        onClose={() => setAssistantToEdit(null)}
                        assistant={assistantToEdit}
                        formMethods={hireFormMethods}
                        onSubmit={initiateUpdate}
                        isSubmitting={isFormSubmitting}
                        isProcessingPhoto={isDialogBusyProcessingPhoto}
                        isProcessingVoice={isDialogBusyProcessingVoice}
                    >
                         <HireForm
                            assistants={assistants}
                            formMethods={hireFormMethods}
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
                        />
                    </AssistantEdit>
                )}
                {contactManagerAssistant && (
                    <AssistantContactManager
                        isOpen={!!contactManagerAssistant}
                        onClose={() => setContactManagerAssistant(null)}
                        assistant={contactManagerAssistant}
                        formMethods={hireFormMethods}
                        onSubmit={initiateUpdate}
                        isSubmitting={isFormSubmitting}
                        assistantActions={assistantActions}
                        allAssistantEmails={fetchedAssistantEmails}
                        availablePhoneCountries={availablePhoneCountries}
                        isLoadingCountries={isLoadingCountries}
                        availableSocialPlatforms={availableSocialPlatforms}
                        onSuccess={handleUpdateSuccess}
                        initialTab={contactManagerInitialTab}
                        canWrite={canWrite(contactManagerAssistant)}
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
                        onMinimize={handleMinimizeCall}
                        assistant={activeCallAssistant}
                        assistantActions={assistantActions}
                        room={room}
                        chatHistories={profileChatHistories}
                        setChatHistories={setProfileChatHistories}
                        isConnecting={isConnectingCall}
                        userImage={userMeta.image}
                        isWaitingForAssistant={isWaitingForAssistant}
                        isCallConnected={isCallConnected}
                        connectionError={connectionError}
                        onRetry={retryConnection}
                        isRemoteControlActive={isRemoteControlActive}
                        liveviewUrl={liveviewUrl}
                        isRemoteControlLoading={isRemoteControlLoading}
                        toggleRemoteControl={toggleRemoteControl}
                        isRemoteControlInteractive={isRemoteControlInteractive}
                        toggleRemoteControlInteractive={toggleRemoteControlInteractive}
                        callType={callType}
                        connectionDetails={connectionDetails}
                    />
                    {isCallMinimized && (
                         <AssistantCommunicationMinimized
                            assistant={activeCallAssistant}
                            room={room}
                            onHangUp={handleHangUp}
                            onExpand={handleExpandCall}
                            isSpeakerMuted={isSpeakerMuted}
                            onToggleSpeaker={toggleSpeakerMute}
                            isConnecting={isConnectingCall}
                            isCallConnected={isCallConnected}
                            isWaitingForAssistant={isWaitingForAssistant}
                            connectionError={connectionError}
                            onRetry={retryConnection}
                            callType={callType}
                        />
                    )}
                </RoomContext.Provider>
            )}
        </>
    );
}