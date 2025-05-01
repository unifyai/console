'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Team/AssistantList";
import { TaskList } from "@/components/Team/TaskList";
import { cn } from '@/lib/utils';
import { Assistant, AssistantActions } from "@/types/assistants/assistant";
import { Task, TaskActions, TaskStatus } from '@/types/assistants/task';
import { LogProps } from '@/types/evals/logs';
import { AssistantProfilePanel } from './AssistantProfilePanel';
import { AnimatePresence, motion } from 'framer-motion';
import { useDebounce } from 'react-use';
import { ResponseProps } from '@/types/common';
import { toast } from "sonner";

const TASK_PAGE_LIMIT = 20;

// Helper function to map LogProps to Task
const mapLogToTask = (log: LogProps): Task | null => {

    const taskId = log?.id;
    const title = log?.entries?.title as string | undefined;
    const description = log?.entries?.description as string | undefined;
    const status = log?.entries?.status as string | undefined;
    const assigned = log?.entries?.assignedAssistantIds as string[] | string | undefined;

    if (!taskId || typeof title !== 'string') {
        console.warn("Skipping log due to missing id or title:", log);
        return null;
    }

    const taskStatus: TaskStatus = status && typeof status === 'string' ? status : 'Queued';

    // Ensure assigned is always an array of strings, handling potential single string or array input
    let assignedIds: string[] = [];
    if (Array.isArray(assigned)) {
        assignedIds = assigned.map(String).filter(id => id); // Filter out empty strings
    } else if (typeof assigned === 'string' && assigned.trim()) {
        assignedIds = [assigned.trim()];
    }


    return {
        taskId: taskId,
        title: title,
        description: description || '',
        status: taskStatus,
        assignedAssistantIds: assignedIds,
    };
}


// Helper to build filter expression
const buildFilterExpression = (searchTerm: string, statusFilter: string, assignedFilter: string[]): string | null => {
    const filters: string[] = [];
    if (searchTerm.trim()) {
        filters.push(`${searchTerm.trim().replace(/'/g, "\\'")} in title`);
    }
    if (statusFilter !== 'all') {
        filters.push(`status == '${statusFilter}'`);
    }
    if (assignedFilter.length > 0) {
        const assignedClauses = assignedFilter.map(id => `'${id}' in assignedAssistantIds`);
        if (assignedClauses.length > 1) {
            filters.push(`(${assignedClauses.join(" or ")})`);
        } else if (assignedClauses.length === 1) {
            filters.push(assignedClauses[0]);
        }
    }
    return filters.length > 0 ? filters.join(" and ") : null;
};

// Helper to check if a profile photo likely needs a signed URL or is a GCS URL
const isGcsPhoto = (photoPath: string | null | undefined): boolean => {
    if (!photoPath) {
        return false;
    }
    // Specifically check if the URL points to Google Cloud Storage.
    return photoPath.includes('storage.googleapis.com');
};

// Define props including the actions passed from the page
interface MainProps {
    taskActions: TaskActions;
    assistantActions: AssistantActions;
}

export default function Main({ taskActions, assistantActions }: MainProps) {
    // Assistant state
    const [assistants, setAssistants] = React.useState<Assistant[]>([]);
    const [isLoadingAssistants, setIsLoadingAssistants] = React.useState(true); // Loading state for assistants
    const [assistantError, setAssistantError] = React.useState<string | null>(null); // Error state for assistants

    // Task state
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [offset, setOffset] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);
    const [hasMoreTasks, setHasMoreTasks] = React.useState(true);
    const [isLoadingInitialTasks, setIsLoadingInitialTasks] = React.useState(true); // Task-specific initial loading
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [taskError, setTaskError] = React.useState<string | null>(null);
    const [initialTaskFetchTriggered, setInitialTaskFetchTriggered] = React.useState(false); // Track if initial task fetch started

    // Filter state
    const [searchTermInput, setSearchTermInput] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [assignedFilter, setAssignedFilter] = React.useState<string[]>([]);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
    useDebounce(() => setDebouncedSearchTerm(searchTermInput), 300, [searchTermInput]); // Debounce search input
    const [currentFilterExpr, setCurrentFilterExpr] = React.useState<string | null>(null);

    // --- Data Fetching & Actions ---

    // Fetch Assistants Action
    const fetchAssistants = React.useCallback(async () => {
        setIsLoadingAssistants(true);
        setInitialTaskFetchTriggered(false); // Reset task fetch trigger if assistants are reloaded
        setIsLoadingInitialTasks(true); // Mark tasks as needing initial load again
        setAssistantError(null);
        try {
            const listResult = await assistantActions.list();

            // Check for error structure from backend (e.g., { detail: "error message" })
            if (typeof listResult === 'object' && listResult !== null && 'detail' in listResult && typeof (listResult as ResponseProps).detail === 'string') {
                throw new Error((listResult as ResponseProps).detail);
            }

            // Check if the result is an array of assistants
            if (!Array.isArray(listResult)) {
                const detail = (typeof listResult === 'object' && listResult !== null && 'detail' in listResult) ? (listResult as any).detail : "Invalid response format";
                throw new Error(`Invalid response format received for assistants: ${detail}`);
            }

            // Ensure essential fields exist for each assistant before setting state
            const validAssistants = listResult.filter(a => a && a.agent_id && a.first_name && a.surname);
            if (validAssistants.length !== listResult.length) {
                console.warn("Some assistant data was incomplete and filtered out.");
            }

            // Fetch signed URLs for GCS profile photos concurrently
            const assistantsWithSignedUrls = await Promise.all(
                validAssistants.map(async (assistant) => {
                    if (isGcsPhoto(assistant.profile_photo)) { // Check specifically if it's a GCS photo
                        try {
                            const photoResult = await assistantActions.downloadPhoto(assistant.profile_photo);
                            if (photoResult.signedUrl) {
                                return { ...assistant, signedProfilePhotoUrl: photoResult.signedUrl };
                            } else {
                                console.warn(`[Main.tsx] Failed to get signed URL for ${assistant.agent_id} (${assistant.profile_photo}): ${photoResult.error || 'Unknown error'}`);
                            }
                        } catch (error) {
                            console.error(`[Main.tsx] Error fetching signed URL for ${assistant.agent_id} (${assistant.profile_photo}):`, error);
                        }
                    }
                    // Return assistant as-is if no signed URL needed or fetching failed
                    return assistant;
                })
            );
            setAssistants(assistantsWithSignedUrls); // Update state with potentially added signed URLs

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching assistants.";
            console.error("Assistant fetch error:", errorMsg);
            setAssistantError(errorMsg);
            setAssistants([]); // Clear assistants on error
        } finally {
            setIsLoadingAssistants(false);
        }
    }, [assistantActions]); // Depends on list and downloadPhoto actions


    // Fetch Tasks Action
    const fetchTasks = React.useCallback(async (filterExpr: string | null, isInitialLoad = true) => {
        if (!isInitialLoad && isLoadingMore) {
            return; // Prevent concurrent pagination fetches
        }

        const fetchOffset = isInitialLoad ? 0 : offset;

        if (isInitialLoad) {
            setIsLoadingInitialTasks(true); // Set task-specific initial loading
            setTasks([]); // Clear existing tasks for a fresh load/filter
            setOffset(0); // Reset pagination offset
            setHasMoreTasks(true); // Assume there might be tasks initially
            setCurrentFilterExpr(filterExpr); // Store the filter used for this load
        } else {
             if (!hasMoreTasks) {
                return; // Don't fetch if no more tasks
             }
             setIsLoadingMore(true);
        }
        setTaskError(null); // Clear previous task errors

        try {
            const response = await taskActions.get(filterExpr, TASK_PAGE_LIMIT, fetchOffset);

            // Use detail field from response for specific errors
             if (response.detail && (!response.logs || (Array.isArray(response.logs) && response.logs.length === 0))) {
                 // Consider 'detail' an error only if it exists AND logs are empty/missing
                 throw new Error(response.detail);
             }

            // Ensure response.logs is always an array before mapping
            const fetchedLogs = Array.isArray(response.logs) ? response.logs : [];
            const mappedTasks: Task[] = fetchedLogs.map(mapLogToTask).filter((task): task is Task => task !== null);

            // Update tasks state - replace on initial, append otherwise
             setTasks(prevTasks => isInitialLoad ? mappedTasks : [...prevTasks, ...mappedTasks]);

            // Update total count, offset, and hasMoreTasks flag
            const newTotalCount = response.count ?? (isInitialLoad ? mappedTasks.length : tasks.length + mappedTasks.length); // Estimate count if not provided
            setTotalCount(newTotalCount);
            const newLoadedCount = fetchOffset + mappedTasks.length;
            setOffset(newLoadedCount);
            setHasMoreTasks(newLoadedCount < newTotalCount && mappedTasks.length > 0); // Also check if the last fetch returned items

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching tasks.";
            console.error("Task fetch error:", errorMsg);
            setTaskError(errorMsg);
            if (isInitialLoad) setTasks([]); // Clear tasks on initial load error
            setHasMoreTasks(false); // Stop pagination on error
        } finally {
             if (isInitialLoad) setIsLoadingInitialTasks(false); // End task-specific initial loading
             setIsLoadingMore(false);
        }
    }, [taskActions, offset, isLoadingMore, hasMoreTasks, tasks.length]); // Added tasks.length for count estimation

    // Update Assistant Profile Action
    const updateAssistantProfile = React.useCallback(async (id: string, about: string | null, phone: string | null, email: string | null) => {
        try {
            // Note: This only updates text fields. Photo updates would require a separate flow.
            const result = await assistantActions.update(id, about, phone, email);
            if (typeof result === 'object' && result !== null && 'detail' in result && typeof (result as ResponseProps).detail === 'string') {
                throw new Error((result as ResponseProps).detail);
            }

            // optimistic update for text fields
            setAssistants((prevAssistants) => {
                return prevAssistants.map((assistant) => {
                    if (assistant.agent_id === id) {
                        // Preserve the existing signedProfilePhotoUrl if it exists
                        return { ...assistant, about: about, phone: phone, email: email };
                    }
                    return assistant;
                });
            });
             // No separate toast here, handled in AssistantProfilePanel
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while updating assistant.";
            console.error("Assistant update error:", errorMsg);
            // Consider reverting optimistic update on error
            fetchAssistants(); // Re-fetch to ensure data consistency after failed update
            throw error; // re-throw so the UI can handle it
        }
    }, [assistantActions, setAssistants, fetchAssistants]);

    // Delete Assistant Action (Handler)
    const handleDeleteAssistant = React.useCallback(async (assistantToDelete: Assistant) => {
        const assistantId = assistantToDelete.agent_id;
        const displayName = `${assistantToDelete.first_name} ${assistantToDelete.surname}`;
        const photoPath = assistantToDelete.profile_photo; // Original path/URL
        const isGcs = isGcsPhoto(photoPath); // Check if it's a GCS photo

        try {
            // Step 1: Delete assistant record via API
            const deleteResult = await assistantActions.delete(assistantId);
            if (!deleteResult.info) { // Check for failure indicated by the backend response
                throw new Error(deleteResult.detail || "Failed to delete assistant record.");
            }

            // Step 2: If it was a GCS photo, attempt to delete it from storage
            let photoDeleteMessage = "";
            if (isGcs && photoPath) {
                const photoDeleteResult = await assistantActions.deletePhoto(photoPath);
                if (!photoDeleteResult.success) {
                    console.warn(`[Main.tsx handleDeleteAssistant] Failed to delete photo for ${displayName}: ${photoDeleteResult.message}`);
                    // Don't throw error, just log a warning and maybe add to success message
                    photoDeleteMessage = ` (Warning: ${photoDeleteResult.message || 'Could not delete photo'})`;
                    toast.warning(`Problem deleting profile photo for ${displayName}.`, { description: photoDeleteResult.message });
                } else {
                    photoDeleteMessage = " (Profile photo deleted)";
                }
            }

            // Step 3: Update UI state (remove assistant, close panel)
            setAssistants((prev) => prev.filter((a) => a.agent_id !== assistantId));
            handleProfileClose(); // Close the profile panel
            toast.success(`${displayName} removed from team${photoDeleteMessage}.`);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`[Main.tsx handleDeleteAssistant] Error during deletion process for ${displayName}:`, errorMsg);
            throw error; // Re-throw the error so the panel knows it failed
        }
    }, [assistantActions, setAssistants]);

    // Effect 1: Fetch assistants on mount
    React.useEffect(() => {
        fetchAssistants();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Effect 2: Fetch tasks based on assistant status and filter changes
    React.useEffect(() => {
        // Wait until assistants are loaded (or failed)
        if (isLoadingAssistants) {
            return;
        }

        // Handle assistant loading failure - prevent task fetching
        if (assistantError) {
            console.error("Cannot fetch tasks because assistants failed to load.");
            setIsLoadingInitialTasks(false); // Stop task loading indicator
            setTaskError(`Assistants failed to load: ${assistantError}`);
            setTasks([]); // Ensure task list is empty
            setHasMoreTasks(false);
            return;
        }

        // Assistants are loaded successfully. Now handle task fetching.
        const newFilterExpr = buildFilterExpression(debouncedSearchTerm, statusFilter, assignedFilter);

        // Trigger initial task fetch *only once* after assistants are ready
        if (!initialTaskFetchTriggered) {
            fetchTasks(newFilterExpr, true);
            setInitialTaskFetchTriggered(true); // Mark initial fetch as triggered
        }
        // Trigger task fetch on subsequent filter changes *after* the initial fetch
        else if (newFilterExpr !== currentFilterExpr) {
            fetchTasks(newFilterExpr, true); // Refetch with new filters (treat as initial load for the new filter set)
        }

    }, [
        fetchTasks,
        isLoadingAssistants, // Wait for this to be false
        assistantError,      // React to errors here
        initialTaskFetchTriggered, // Controls the initial vs subsequent logic
        debouncedSearchTerm, // Filter dependencies
        statusFilter,
        assignedFilter,
        currentFilterExpr   // Compare against the last used filter
    ]);


    // Callback for TaskList infinite scroll
    const fetchMoreTasks = React.useCallback(() => {
        // Guard clauses inside fetchTasks handle isLoadingMore and hasMoreTasks checks
        if (!isLoadingAssistants && !assistantError) { // Only paginate if assistants are loaded
             fetchTasks(currentFilterExpr, false); // Use the current filter expression for pagination
        }
    }, [fetchTasks, currentFilterExpr, isLoadingAssistants, assistantError]); // Depends on the memoized fetchTasks and the filter it should use


    // --- UI State and Handlers ---
    const [chatTargetAssistantId, setChatTargetAssistantId] = React.useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);

    const chatAssistant = React.useMemo(() => {
        // Find assistant from state (which includes signed URLs)
        return assistants.find(a => a.agent_id === chatTargetAssistantId) || null;
    }, [assistants, chatTargetAssistantId]);

    const profileAssistant = React.useMemo(() => {
        // Find assistant from state (which includes signed URLs)
        return assistants.find(a => a.agent_id === profileAssistantId) || null;
    }, [assistants, profileAssistantId]);

    const handleChat = (id: string) => {
        setChatTargetAssistantId(id);
        setIsChatOpen(true);
        if (isProfileOpen && profileAssistantId !== id) {
             setIsProfileOpen(false);
             setProfileAssistantId(null);
        }
    };

    const handleChatClose = () => setIsChatOpen(false);

    const handleShowProfile = (id: string) => {
        if (isProfileOpen && profileAssistantId === id) {
                setIsProfileOpen(false);
                setProfileAssistantId(null);
        } else {
                setProfileAssistantId(id);
                setIsProfileOpen(true);
                if (isChatOpen && chatTargetAssistantId !== id) setIsChatOpen(false);
        }
    };

    const handleProfileClose = () => {
        setIsProfileOpen(false);
        setProfileAssistantId(null);
    };

    // --- Render Logic ---

     // Critical Error Display (if initial assistant fetch failed and we have no assistants)
     if (assistantError && assistants.length === 0 && !isLoadingAssistants) {
         // This case is mainly handled by the error state within AssistantList now,
         // but keeping a top-level check can be a fallback.
         return <div className="flex items-center justify-center h-screen text-destructive p-6 text-center">Error loading team data: {assistantError}. Please try refreshing the page.</div>;
     }

    // Determine if TaskList should show skeletons
    // Show skeletons if assistants are loading OR if the initial task fetch hasn't finished yet
    const showTaskSkeletons = isLoadingAssistants || isLoadingInitialTasks;

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Assistant List Panel */}
            <div className={cn(
                "h-full transition-all duration-300 ease-in-out relative border-r",
                "w-1/3 lg:w-[400px] xl:w-[450px] flex-shrink-0"
            )}
            >
                 <AssistantList
                    assistants={assistants}
                    isLoading={isLoadingAssistants}
                    error={assistantError}
                    profileAssistantId={profileAssistantId}
                    chatTargetAssistantId={chatTargetAssistantId}
                    onShowProfile={handleShowProfile}
                    onChat={handleChat}
                    isChatOpen={isChatOpen}
                    chatAssistant={chatAssistant}
                    onChatClose={handleChatClose}
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
                            onUpdateProfile={updateAssistantProfile}
                            onDeleteAssistant={handleDeleteAssistant}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Task List Panel */}
            <div className="flex-1 h-full min-w-0 overflow-hidden relative">
                 <TaskList
                    tasks={tasks}
                    fetchMoreTasks={fetchMoreTasks}
                    hasMoreTasks={hasMoreTasks}
                    isLoadingMore={isLoadingMore}
                    isLoadingInitial={showTaskSkeletons}
                    allAssistants={assistants}
                    searchTerm={searchTermInput}
                    setSearchTerm={setSearchTermInput}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    assignedFilter={assignedFilter}
                    setAssignedFilter={setAssignedFilter}
                    updateTask={taskActions.update}
                 />
                 {/* Display task error messages */}
                 {taskError && !showTaskSkeletons && ( 
                    // Only show error if not actively loading initial data
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-destructive/10 text-destructive text-xs px-3 py-1 rounded-full border border-destructive/30 z-20">
                        {`Error loading tasks: ${taskError}`}
                    </div>
                 )}
            </div>
        </div>
    );
}