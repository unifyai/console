'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Team/Assistants/List/AssistantList";
import { TaskList } from "@/components/Team/Tasks/List/TaskList";
import { cn } from '@/lib/utils';
import { Assistant, AssistantActions, AssistantPreset } from "@/types/team/assistant";
import { TaskActions, Status as TaskStatusEnum } from "@/types/team/task";
import { toast, Toaster } from "sonner";
import { AssistantProfilePanel } from './Assistants/AssistantProfile';
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

// Constants
import assistantPresetsConstant from "@/constants/assistants/assistant_presets.js";

interface MainProps {
    taskActions: TaskActions;
    assistantActions: AssistantActions;
}

export default function Main({ taskActions, assistantActions }: MainProps) {
    // --- UI Panel Management ---
    const {
        profileAssistantId, isProfileOpen,
        handleShowProfile, handleProfileClose,
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

    // Tasks can start fetching immediately
    const [initialTaskFetchTriggered, setInitialTaskFetchTriggered] = React.useState(true);

    const {
        tasks, fetchMoreTasks, hasMoreTasks, isLoadingMore: isLoadingMoreTasks,
        isLoadingInitial: isLoadingInitialTasks, initialLoadError: taskLoadError,
        updateLocalTask,
    } = useTasks(taskActions, filterExpression, initialTaskFetchTriggered);


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
        hireFormMethods, isSubmitting: isHireSubmitting,
        onSubmit: handleHireFormSubmitInternal,
        selectPreset: selectPresetForHireForm,
        resetForm: resetHireFormInternal,
    } = useAssistantHireForm(assistantActions, handleHireSuccess);


    // --- Effects ---

    const initialAssistantLoadProcessedRef = React.useRef(false);
    React.useEffect(() => {
        if (!isLoadingAssistants && !initialAssistantLoadProcessedRef.current) {
            initialAssistantLoadProcessedRef.current = true;
            if (!assistantError && assistants.length === 0) {
                handleOpenHireDialog();
            }
        }
    }, [assistants, isLoadingAssistants, assistantError]); 


    // --- Callbacks for UI interaction ---
    const handleOpenHireDialog = React.useCallback(() => {
        resetHireFormInternal({ });
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
        const success = await updateAssistantProfile(id, about, phone, email, assistant?.voice_id || null);
        if (!success) throw new Error("Update failed in hook.");
    };

    const onDeleteAssistantSubmit = async (assistant: Assistant) => {
        const success = await deleteAssistant(assistant);
        if (success) {
            handleProfileClose(); 
        } else {
            throw new Error("Deletion failed in hook.");
        }
    };

    // --- Memoized values for props ---
    const profileAssistant = React.useMemo(() => assistants.find(a => a.agent_id === profileAssistantId) || null, [assistants, profileAssistantId]);
    const isCombinedLoadingInitial = initialTaskFetchTriggered && isLoadingInitialTasks;

    return (
        <>
            <Toaster richColors position="bottom-right" closeButton />

            <div className="flex h-screen bg-background overflow-hidden">
                {/* Assistant List */}
                <div className={cn("h-full transition-all duration-300 ease-in-out relative border-r", "w-1/3 lg:w-[400px] xl:w-[450px] flex-shrink-0")}>
                    <AssistantList
                        assistants={assistants}
                        assistantError={assistantError}
                        isLoading={isLoadingAssistants}
                        error={assistantError}
                        profileAssistantId={profileAssistantId}
                        onShowProfile={handleShowProfile}
                        onOpenHireDialog={handleOpenHireDialog}
                    />
                </div>

                {/* Assistant Profile Panel */}
                <AnimatePresence initial={false}>
                    {isProfileOpen && profileAssistant && (
                        <motion.div
                            key="assistant-profile"
                            initial={{ width: "0%", opacity: 0, x: "-1%" }}
                            animate={{ width: "25%", opacity: 1, x: "0%" }}
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
                isHireSubmitting={isHireSubmitting}
                setIsHireDialogOpen={setIsHireDialogOpen}
                isAssistantPresetsOpen={isAssistantPresetsOpen}
                setIsAssistantPresetsOpen={setIsAssistantPresetsOpen}
                handleRandomizePreset={handleRandomizePreset}
                currentFilteredPresets={currentFilteredPresets}
                handleHireFormSubmitInternal={handleHireFormSubmitInternal}
                isProcessingVoice={isDialogBusyProcessingVoice} 
            >
                <HireForm
                    formMethods={hireFormMethods}
                    onSubmit={handleHireFormSubmitInternal}
                    isSubmitting={isHireSubmitting}
                    assistantActions={assistantActions}
                    onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice} 
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