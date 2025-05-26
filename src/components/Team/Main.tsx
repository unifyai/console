'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Team/Assistants/List/AssistantList";
import { TaskList } from "@/components/Team/Tasks/List/TaskList";
import { cn } from '@/lib/utils';
import { Assistant, AssistantActions, AssistantPreset } from "@/types/team/assistant";
import { ActivityLogActions, MessageLog } from "@/types/team/activity";
import { TaskActions, Status as TaskStatusEnum } from "@/types/team/task";
import { toast, Toaster } from "sonner";
import { AssistantProfilePanel } from './Assistants/AssistantProfile';
import { AssistantActivityLogPanel } from './Assistants/Activity/AssistantActivityLogPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantHire } from './Assistants/Hire/AssistantHire';
import { HireForm } from '@/components/Team/Assistants/Hire/AssistantHireForm';
import { PresetsPanel } from '@/components/Team/Assistants/Hire/Presets/AssistantHirePresetsList';

// Import Hooks
import { useAssistants } from '@/hooks/Team/useAssistants';
import { useTaskFilters } from '@/hooks/Team/useTaskFilters';
import { useTasks } from '@/hooks/Team/useTasks';
import { useAssistantPresets } from '@/hooks/Team/useAssistantPresets';
import { useAssistantHireForm } from '@/hooks/Team/useAssistantHireForm';
import { usePanelManager } from '@/hooks/Team/usePanelManager';
import { useActivityLogs } from '@/hooks/Team/useActivityLogs';

// Constants
import assistantPresetsConstant from "@/constants/assistants/assistant_presets.js";

interface MainProps {
    taskActions: TaskActions;
    assistantActions: AssistantActions;
    activityLogActions: ActivityLogActions;
}

export default function Main({ taskActions, assistantActions, activityLogActions }: MainProps) {
    // --- UI Panel Management ---
    const {
        profileAssistantId, isProfileOpen,
        handleShowProfile, handleProfileClose,
        activityLogAssistantId, isActivityLogOpen,
        handleShowActivityLog, handleActivityLogClose,
    } = usePanelManager();

    // --- Assistant Data & Actions ---
    const {
        assistants,
        isLoading: isLoadingAssistants,
        error: assistantError,
        refreshAssistants,
        deleteAssistant,
        updateAssistantProfile,
    } = useAssistants(assistantActions); 

    // --- Task Filters & Data ---
    const {
        searchTermInput, setSearchTermInput,
        statusFilter, setStatusFilter,
        priorityFilter, setPriorityFilter,
        deadlineFilter, setDeadlineFilter,
        filterExpression,
    } = useTaskFilters();

    const [initialTaskFetchTriggered, setInitialTaskFetchTriggered] = React.useState(true);

    const {
        tasks, fetchMoreTasks, hasMoreTasks, isLoadingMore: isLoadingMoreTasks,
        isLoadingInitial: isLoadingInitialTasks, initialLoadError: taskLoadError,
        updateLocalTask,
    } = useTasks(taskActions, filterExpression, initialTaskFetchTriggered);

    // --- Activity Log Data ---
    const {
        messages: assistantMessages,
        fetchMoreMessages: fetchMoreAssistantMessages,
        hasMoreMessages: hasMoreAssistantMessages,
        isLoadingInitial: isLoadingInitialMessages,
        isLoadingMore: isLoadingMoreMessages,
        logError: messageLogError,
    } = useActivityLogs(activityLogActions, activityLogAssistantId, assistants, "user");


    const availableTaskStatuses = React.useMemo(() => {
        return ['all', ...Object.values(TaskStatusEnum)];
    }, []);


    // --- Hire Assistant Dialog & Form ---
    const [isHireDialogOpen, setIsHireDialogOpen] = React.useState(false);
    const [isAssistantPresetsOpen, setIsAssistantPresetsOpen] = React.useState(true);
    const [isDialogBusyProcessingVoice, setIsDialogBusyProcessingVoice] = React.useState(false); 

    const {
        displayedPresets, loadMorePresets, canLoadMorePresets, isLoadingMorePresets,
        presetAgeFilter, setPresetAgeFilter,
        presetRegionFilter, setPresetRegionFilter,
        presetGenderFilter, setPresetGenderFilter,
        availableAgeBrackets, availableRegions, availableGenders,
        currentFilteredPresets,
    } = useAssistantPresets();

    const handleHireSuccess = React.useCallback((newAssistant: Assistant) => {
        refreshAssistants(false);
        setIsHireDialogOpen(false);
        handleShowProfile(newAssistant.agent_id);
    }, [refreshAssistants, handleShowProfile]);

    const {
        hireFormMethods,
        initiateHireSequence,
        isCheckingBalance,
        isSubmitting: isHireFormSubmitting,
        showInsufficientFundsHint,
        setShowInsufficientFundsHint,
        selectPreset: selectPresetForHireForm,
        resetForm: resetHireFormInternal,
        rhfInternalFormSubmit,
        fetchedAssistantEmails,
    } = useAssistantHireForm(assistantActions, handleHireSuccess, isHireDialogOpen);
    
    // --- Callbacks for UI interaction ---
    const handleOpenHireDialog = React.useCallback(() => {
        resetHireFormInternal();
        setIsAssistantPresetsOpen(true);
        setPresetAgeFilter('all');
        setPresetRegionFilter('all');
        setPresetGenderFilter('all');
        setIsDialogBusyProcessingVoice(false); 

        const presetsToUse = currentFilteredPresets.length > 0 ? currentFilteredPresets : (assistantPresetsConstant as AssistantPreset[]);
        if (presetsToUse.length > 0) {
            const randomIndex = Math.floor(Math.random() * presetsToUse.length);
            selectPresetForHireForm(presetsToUse[randomIndex]);
        }
        setIsHireDialogOpen(true); 
    }, [resetHireFormInternal, currentFilteredPresets, selectPresetForHireForm, setPresetAgeFilter, setPresetRegionFilter, setPresetGenderFilter]);

    const handleRandomizePreset = () => {
        if (currentFilteredPresets.length === 0) {
            toast.info("No presets match filters.", { duration: 3000 });
            return;
        }
        const randomIndex = Math.floor(Math.random() * currentFilteredPresets.length);
        selectPresetForHireForm(currentFilteredPresets[randomIndex]);
    };
    
    // Profile Panel Actions
    const onUpdateProfileSubmit = async (id: string, about: string | null, phone: string | null, email: string | null) => {
        const assistant = assistants.find(a => a.agent_id === id);
        const success = await updateAssistantProfile(id, about, phone, email, assistant?.whatsapp_sid || null, assistant?.voice_id || null);
        if (!success) throw new Error("Update failed in hook.");
    };

    const onDeleteAssistantSubmit = async (assistant: Assistant) => {
        const success = await deleteAssistant(assistant);
        if (success) {
            handleProfileClose(); 
            if (activityLogAssistantId === assistant.agent_id) { 
                handleActivityLogClose();
            }
        } else {
            throw new Error("Deletion failed in hook.");
        }
    };
    
    // --- Effects ---
    const initialAssistantLoadProcessedRef = React.useRef(false);
    React.useEffect(() => {
        if (!isLoadingAssistants && !initialAssistantLoadProcessedRef.current) {
            initialAssistantLoadProcessedRef.current = true;
            if (!assistantError && assistants.length === 0) {
                handleOpenHireDialog();
            }
        }
    }, [assistants, isLoadingAssistants, assistantError, handleOpenHireDialog]);

    // --- Memoized values for props ---
    const profileAssistant = React.useMemo(() => assistants.find(a => a.agent_id === profileAssistantId) || null, [assistants, profileAssistantId]);
    const activityLogPanelAssistant = React.useMemo(() => assistants.find(a => a.agent_id === activityLogAssistantId) || null, [assistants, activityLogAssistantId]);
    const isCombinedLoadingInitial = initialTaskFetchTriggered && isLoadingInitialTasks;
    
    // Determine active panel for width calculations
    const activeSidePanelCount = (isProfileOpen ? 1 : 0) + (isActivityLogOpen ? 1 : 0);
    const assistantListWidth = activeSidePanelCount === 2 ? "w-1/4 lg:w-[300px] xl:w-[350px]" 
                             : activeSidePanelCount === 1 ? "w-1/3 lg:w-[350px] xl:w-[400px]" 
                             : "w-1/3 lg:w-[400px] xl:w-[450px]"; 

    const panelBaseWidth = activeSidePanelCount === 2 ? "20%" : "25%";


    return (
        <>
            <Toaster richColors position="bottom-right" closeButton />

            <div className="flex h-screen bg-background overflow-hidden">
                {/* Assistant List */}
                <div className={cn("h-full transition-all duration-300 ease-in-out relative border-r", assistantListWidth, "flex-shrink-0")}>
                    <AssistantList
                        assistants={assistants}
                        assistantError={assistantError}
                        isLoading={isLoadingAssistants}
                        error={assistantError}
                        profileAssistantId={profileAssistantId}
                        activityLogAssistantId={activityLogAssistantId}
                        onShowProfile={handleShowProfile}
                        onShowActivityLog={handleShowActivityLog}
                        onOpenHireDialog={handleOpenHireDialog}
                    />
                </div>

                {/* Assistant Profile Panel */}
                <AnimatePresence initial={false}>
                    {isProfileOpen && profileAssistant && (
                        <motion.div
                            key="assistant-profile"
                            initial={{ width: "0%", opacity: 0, x: "-1%" }}
                            animate={{ width: panelBaseWidth, opacity: 1, x: "0%" }}
                            exit={{ width: "0%", opacity: 0, x: "-1%" }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                            className="h-full flex-shrink-0 border-r overflow-hidden bg-background"
                        >
                            <AssistantProfilePanel
                                assistant={profileAssistant}
                                onClose={handleProfileClose}
                                onUpdateProfile={onUpdateProfileSubmit}
                                onDeleteAssistant={onDeleteAssistantSubmit}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Assistant Activity Log Panel */}
                <AnimatePresence initial={false}>
                    {isActivityLogOpen && activityLogPanelAssistant && (
                        <motion.div
                            key="assistant-activity-log"
                            initial={{ width: "0%", opacity: 0, x: isProfileOpen ? "0%" : "-1%" }} 
                            animate={{ width: panelBaseWidth, opacity: 1, x: "0%" }}
                            exit={{ width: "0%", opacity: 0, x: isProfileOpen ? "0%" : "-1%" }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                            className="h-full flex-shrink-0 border-r overflow-hidden bg-background"
                        >
                            <AssistantActivityLogPanel
                                assistant={activityLogPanelAssistant}
                                messages={assistantMessages}
                                fetchMoreMessages={fetchMoreAssistantMessages}
                                hasMoreMessages={hasMoreAssistantMessages}
                                isLoadingInitial={isLoadingInitialMessages}
                                isLoadingMore={isLoadingMoreMessages}
                                logError={messageLogError}
                                onClose={handleActivityLogClose}
                            />
                        </motion.div>
                    )}
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
                    />
                </div>
            </div>

            {/* Hire Dialog */}
            <AssistantHire
                isHireDialogOpen={isHireDialogOpen}
                isHireSubmitting={isHireFormSubmitting}
                setIsHireDialogOpen={setIsHireDialogOpen}
                isAssistantPresetsOpen={isAssistantPresetsOpen}
                setIsAssistantPresetsOpen={setIsAssistantPresetsOpen}
                handleRandomizePreset={handleRandomizePreset}
                currentFilteredPresets={currentFilteredPresets}
                onHireAttempt={initiateHireSequence}
                isProcessingVoice={isDialogBusyProcessingVoice} 
                isCheckingBalance={isCheckingBalance}
                showInsufficientFundsHint={showInsufficientFundsHint}
                setShowInsufficientFundsHint={setShowInsufficientFundsHint}
            >
                <HireForm
                    formMethods={hireFormMethods}
                    onSubmit={rhfInternalFormSubmit}
                    isSubmitting={isHireFormSubmitting}
                    assistantActions={assistantActions}
                    onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice} 
                    allAssistantEmails={fetchedAssistantEmails}
                />
                <PresetsPanel                                    
                    displayedPresets={displayedPresets}
                    onPresetSelect={selectPresetForHireForm}
                    onClose={() => setIsAssistantPresetsOpen(false)}
                    onLoadMore={loadMorePresets}
                    canLoadMore={canLoadMorePresets}
                    isLoadingMore={isLoadingMorePresets}
                    ageFilter={presetAgeFilter} onAgeFilterChange={setPresetAgeFilter}
                    availableAgeBrackets={availableAgeBrackets}
                    regionFilter={presetRegionFilter} onRegionFilterChange={setPresetRegionFilter}
                    availableRegions={availableRegions}
                    genderFilter={presetGenderFilter} onGenderFilterChange={setPresetGenderFilter}
                    availableGenders={availableGenders} 
                />
            </AssistantHire>
        </>
    );
}