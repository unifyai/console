'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Team/AssistantList";
import { TaskList } from "@/components/Team/TaskList";
import { cn } from '@/lib/utils';
import { Assistant, AssistantActions, AssistantFormData, AssistantPreset } from "@/types/team/assistant";
import { Task, TaskActions,  } from "@/types/team/task";
import { LogProps, LogsResponseProps } from '@/types/evals/logs';
import { AssistantProfilePanel } from './AssistantProfile';
import { AnimatePresence, motion } from 'framer-motion';
import { useDebounce } from 'react-use';
import { ResponseProps } from '@/types/common';
import { toast, Toaster } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { useForm } from "react-hook-form";
import { HireForm } from '@/components/Team/AssistantHireForm';
import { PresetsPanel } from '@/components/Team/AssistantHirePresetsList';
import assistantPresets from "@/constants/assistants/assistant_presets";
import { LayoutList, Loader2, X } from 'lucide-react';

const TASK_PAGE_LIMIT = 20;

// Helper function to map LogProps to Task (Unchanged)
const mapLogToTask = (log: LogProps): Task | null => {
    const id = log?.id;
    const title = log?.entries?.title as string | undefined;
    const description = log?.entries?.description as string | undefined;
    const status = log?.entries?.status as string | undefined;
    const assigned = log?.entries?.assignedAssistantIds as string[] | string | undefined;

    if (!id || typeof title !== 'string') {
        console.warn("Skipping log due to missing id or title:", log);
        return null;
    }
    let assignedIds: string[] = [];
    if (Array.isArray(assigned)) {
        assignedIds = assigned.map(String).filter(id => id);
    } else if (typeof assigned === 'string' && assigned.trim()) {
        assignedIds = [assigned.trim()];
    }

    return { id, title, description, status, assignedAssistantIds: assignedIds };
}

// Helper to build filter expression (Unchanged)
const buildFilterExpression = (searchTerm: string, statusFilter: string, assignedFilter: string[]): string | null => {
    const filters: string[] = [];
    if (searchTerm) {
        const safeSearchTerm = searchTerm.replace(/["']/g, ''); // Basic sanitization
        filters.push(`"${safeSearchTerm}" in str(title)`);
    }
    if (statusFilter !== 'all') {
        filters.push(`status == '${statusFilter}'`);
    }
    if (assignedFilter.length > 0) {
        const assignedClauses = assignedFilter.map(id => `'${id}' in assignedAssistantIds`);
        filters.push(`(${assignedClauses.join(" or ")})`);
    }
    return filters.length > 0 ? filters.join(" and ") : null;
};

// Helper to check if a profile photo likely needs a signed URL or is a GCS URL (Unchanged)
const isGcsPhoto = (photoPath: string | null | undefined): boolean => {
    if (!photoPath) return false;
    return photoPath.includes('storage.googleapis.com/');
};

// Helper to shuffle presets (Moved from Hire/Main.tsx)
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

interface MainProps {
    taskActions: TaskActions;
    assistantActions: AssistantActions;
}

export default function Main({ taskActions, assistantActions }: MainProps) {
    // Assistant state
    const [assistants, setAssistants] = React.useState<Assistant[]>([]);
    const [isLoadingAssistants, setIsLoadingAssistants] = React.useState(true);
    const [assistantError, setAssistantError] = React.useState<string | null>(null);

    // Task state
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [offset, setOffset] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);
    const [hasMoreTasks, setHasMoreTasks] = React.useState(true);
    const [isLoadingInitialTasks, setIsLoadingInitialTasks] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [taskError, setTaskError] = React.useState<string | null>(null); // Tracks generic task fetch errors
    const [initialTaskLoadError, setInitialTaskLoadError] = React.useState<string | null>(null); // Specific error for initial task load failure
    const [initialTaskFetchTriggered, setInitialTaskFetchTriggered] = React.useState(false);

    // Filter state
    const [searchTermInput, setSearchTermInput] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [assignedFilter, setAssignedFilter] = React.useState<string[]>([]);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
    useDebounce(() => setDebouncedSearchTerm(searchTermInput), 300, [searchTermInput]);
    const [currentFilterExpr, setCurrentFilterExpr] = React.useState<string | null>(null);

    // Status Filter state
    const [availableStatuses, setAvailableStatuses] = React.useState<string[]>([]);
    const [isLoadingStatuses, setIsLoadingStatuses] = React.useState(true);
    const [statusFetchError, setStatusFetchError] = React.useState<string | null>(null);

    // UI State
    const [chatTargetAssistantId, setChatTargetAssistantId] = React.useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);

    // Hire Dialog State
    const [isHireDialogOpen, setIsHireDialogOpen] = React.useState(false);
    const [isHireSubmitting, setIsHireSubmitting] = React.useState(false);
    const [isAssistantPresetsOpen, setIsAssistantPresetsOpen] = React.useState(true);
    const [sampledPresets, setSampledPresets] = React.useState<AssistantPreset[]>([]);

    // Hire Form Hook
    const hireFormMethods = useForm<AssistantFormData>({
        defaultValues: {
            first_name: '', surname: '', age: null, region: null, about: null,
            imageFile: null, imagePreview: null,
        },
    });
    const { setValue: setHireValue, watch: watchHireForm, reset: resetHireForm, getValues: getHireValues, setError: setHireError, clearErrors: clearHireErrors } = hireFormMethods;

    // --- Hire Dialog Logic ---

    React.useEffect(() => {
        // Sample presets when component mounts or presets data changes
        const shuffled = shuffleArray(assistantPresets as AssistantPreset[]);
        setSampledPresets(shuffled.slice(0, 10)); // Sample 10 presets
    }, []); // Run only once on mount

    // Watch hire form changes (optional, for debugging or complex interactions)
    React.useEffect(() => {
        const subscription = watchHireForm(() => {});
        return () => subscription.unsubscribe();
    }, [watchHireForm]);

    const handleOpenHireDialog = () => {
        resetHireForm(); // Reset form when opening
        setIsAssistantPresetsOpen(true); // Ensure presets are open initially
        setIsHireDialogOpen(true);
    };

    const handleHireImageRemove = () => {
        const currentPreview = getHireValues("imagePreview");
        if (currentPreview && currentPreview.startsWith('blob:')) {
            URL.revokeObjectURL(currentPreview);
        }
        setHireValue("imageFile", null);
        setHireValue("imagePreview", null);
    };

    const handleAssistantPresetSelect = (preset: AssistantPreset) => {
        handleHireImageRemove(); // Clear any custom image first
        setHireValue("first_name", preset.first_name, { shouldValidate: true });
        setHireValue("surname", preset.surname, { shouldValidate: true });
        setHireValue("age", preset.age, { shouldValidate: true });
        setHireValue("region", preset.region, { shouldValidate: true });
        setHireValue("about", preset.about, { shouldValidate: true });
        setHireValue("imagePreview", preset.profile_photo);
        clearHireErrors();
    };

     const uploadImageToGCS = async (file: File, signedUrl: string): Promise<boolean> => {
         try {
             const response = await fetch(signedUrl, {
                 method: 'PUT',
                 headers: { 'Content-Type': file.type },
                 body: file,
             });
             if (!response.ok) {
                 const errorText = await response.text();
                 console.error("GCS Upload Failed:", response.status, errorText);
                 toast.error(`Image upload failed: ${response.statusText} (Status: ${response.status})`);
                 return false;
             }
             return true;
         } catch (error: any) {
            console.error("Error during GCS fetch:", error);
            toast.error(`Image upload network error: ${error.message}`);
            return false;
         }
     };

    const handleHireFormSubmit = async (data: AssistantFormData) => {
        setIsHireSubmitting(true);
        clearHireErrors();
        const toastId = toast.loading("Hiring assistant...");
        let finalImageUrlToSend: string | null = null;

        try {
            const imageFile = data.imageFile;

            if (imageFile instanceof File) {
                const createImageResult = await assistantActions.photo.upload(
                    imageFile.type,
                    imageFile.size
                );

                if ('detail' in createImageResult) {
                    const errorResult = createImageResult as ResponseProps;
                    const errorMsg = createImageResult.detail;
                    console.error("Error from createImage action:", errorResult);
                    toast.error(errorMsg, { id: toastId });
                    setIsHireSubmitting(false);
                    return;
                }

                const successResult = createImageResult as { signedUrl: string, filePath: string, bucketName: string };
                const { signedUrl, filePath: returnedFilePath, bucketName: returnedBucketName } = successResult;

                const uploadSuccess = await uploadImageToGCS(imageFile, signedUrl);
                if (!uploadSuccess) {
                    setIsHireSubmitting(false);
                    // toast error is handled inside uploadImageToGCS
                    return;
                }

                if (returnedBucketName && returnedFilePath) {
                    finalImageUrlToSend = `https://storage.googleapis.com/${returnedBucketName}/${returnedFilePath}`;
                } else {
                    console.error("Error: Missing bucket name or file path after successful createImage action.");
                    toast.error("Error processing image upload.", { id: toastId });
                    setIsHireSubmitting(false);
                    return;
                }

            } else if (data.imagePreview && !data.imagePreview.startsWith('blob:')) {
                // Using a preset image URL or potentially a pasted URL
                finalImageUrlToSend = data.imagePreview;
            }

            // Profile photo validation moved slightly down for clarity
            if (!finalImageUrlToSend && !(imageFile instanceof File)) {
                setHireError("imageFile", { type: "manual", message: "Profile photo is required." });
                toast.error("Profile photo is required.", { id: toastId });
                setIsHireSubmitting(false);
                return;
            }

            // Age validation
            const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
            if (!ageNumber || isNaN(ageNumber) || ageNumber <= 0) {
                setHireError("age", { type: "manual", message: "Valid age is required." });
                toast.error("Invalid age provided.", { id: toastId });
                setIsHireSubmitting(false);
                return;
            }

            // Call create action
            const result = await assistantActions.assistant.create(data.first_name, data.surname, ageNumber, data.region, finalImageUrlToSend, data.about);

            if ("info" in result) {
                toast.success(`Assistant ${result.first_name || data.first_name} hired!`, { id: toastId, duration: 4000 });
                setIsHireDialogOpen(false); // Close dialog on success
                await fetchAssistants(false); // Refresh the assistant list without loading toast
            } else {
                const errorResult = result as ResponseProps;
                const errorMessage = errorResult?.detail || errorResult?.message || errorResult?.error || "Failed to hire assistant.";
                console.error("Error response from createAssistant action:", errorResult);
                toast.error(errorMessage, { id: toastId, duration: 5000 });
            }

        } catch (error: any) {
            console.error("Unhandled error in handleHireFormSubmit:", error);
            toast.error(`An error occurred: ${error.message}`, { id: toastId, duration: 5000 });
        } finally {
            setIsHireSubmitting(false);
        }
    };

    // --- Task Update Callback  ---
    const handleTaskUpdate = React.useCallback((taskId: string, updatedFields: Partial<Task>) => {
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.id === taskId
                    ? { ...task, ...updatedFields } // Merge existing task with updated fields
                    : task
            )
        );
        // Optionally re-fetch statuses if the update changed a status that wasn't previously known
        // Consider if this is needed immediately or if next load is fine
        // const existingStatuses = new Set(availableStatuses);
        // if (updatedFields.status && !existingStatuses.has(updatedFields.status)) {
        //     fetchStatuses();
        // }
    }, []);

    // --- Data Fetching & Actions ---

    const fetchAssistants = React.useCallback(async (showLoadingToast = false) => {
        setIsLoadingAssistants(true);
        // Don't reset task state here when only assistants are being fetched/refreshed
        setAssistantError(null);
        setAssistants([]); // Clear current assistants before fetch

        let toastId: string | number | undefined;
        if (showLoadingToast) {
            toastId = toast.loading("Refreshing assistants...");
        }

        try {
            const listResult = await assistantActions.assistant.list();

            // Check for error response first
            if (typeof listResult === 'object' && listResult !== null && 'detail' in listResult && typeof (listResult as ResponseProps).detail === 'string') {
                throw new Error((listResult as ResponseProps).detail);
            }
            // Check for invalid response type
            if (!Array.isArray(listResult)) {
                 const detail = (typeof listResult === 'object' && listResult !== null && 'detail' in listResult) ? (listResult as any).detail : "Invalid response format";
                 throw new Error(`Invalid response format received for assistants: ${detail}`);
            }

            // Process valid assistants
            const validAssistants = listResult.filter(a => a && a.agent_id && a.first_name && a.surname);
            if (validAssistants.length !== listResult.length) {
                console.warn("Some assistant data was incomplete and filtered out.");
            }

            // Fetch signed URLs
            const assistantsWithSignedUrls = await Promise.all(
                validAssistants.map(async (assistant) => {
                    if (isGcsPhoto(assistant.profile_photo)) {
                        try {
                            const photoResult = await assistantActions.photo.download(assistant.profile_photo);
                            if (photoResult.signedUrl) {
                                return { ...assistant, signedProfilePhotoUrl: photoResult.signedUrl };
                            } else {
                                console.warn(`[Main.tsx fetchAssistants] Failed to get signed URL for ${assistant.agent_id} (${assistant.profile_photo}): ${photoResult.detail || 'Unknown error'}`);
                            }
                        } catch (error) {
                            console.error(`[Main.tsx fetchAssistants] Error fetching signed URL for ${assistant.agent_id} (${assistant.profile_photo}):`, error);
                        }
                    }
                    return assistant;
                })
            );
            setAssistants(assistantsWithSignedUrls);
            if (toastId) toast.dismiss(toastId); // Dismiss loading toast on success

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching assistants.";
            console.error("Assistant fetch error:", errorMsg);
            setAssistantError(errorMsg); // Set error state
            setAssistants([]); // Ensure assistants list is empty on error
            toast.error(`Failed to load assistants: ${errorMsg}`, { id: toastId });
        } finally {
            setIsLoadingAssistants(false); // Mark assistant loading as finished (successfully or not)
            // Do NOT set initialTaskFetchTriggered here, that belongs to the task fetch logic
        }
    }, [assistantActions]);

    // Fetch Tasks Action (Handles initial load and pagination)
    const fetchTasks = React.useCallback(async (filterExpr: string | null, isInitialLoad = true) => {
        // Prevent duplicate fetches for pagination
        if (!isInitialLoad && isLoadingMore) return;

        const fetchOffset = isInitialLoad ? 0 : offset;

        if (isInitialLoad) {
            setIsLoadingInitialTasks(true);
            setTasks([]); // Clear tasks for initial load/filter change
            setOffset(0); // Reset offset for initial load/filter change
            setHasMoreTasks(true); // Assume more tasks initially
            setCurrentFilterExpr(filterExpr); // Store the filter used for this load
            setTaskError(null); // Clear generic error
            setInitialTaskLoadError(null); // Clear specific initial load error
        } else {
             // Fetching more, check if we should proceed
             if (!hasMoreTasks) return; // No more tasks to fetch
             setIsLoadingMore(true);
             setTaskError(null); // Clear previous errors before fetching more
        }

        try {
            const response = await taskActions.get(filterExpr, TASK_PAGE_LIMIT, fetchOffset);
            if (response.detail) {
                throw new Error(response.detail);
            }
            const fetchedLogs = Array.isArray(response.logs) ? response.logs : [];
            const mappedTasks: Task[] = fetchedLogs.map(mapLogToTask).filter((task): task is Task => task !== null);

            setTasks(prevTasks => isInitialLoad ? mappedTasks : [...prevTasks, ...mappedTasks]);

            const newTotalCount = (response as LogsResponseProps).count ?? (isInitialLoad ? mappedTasks.length : tasks.length + mappedTasks.length);
            setTotalCount(newTotalCount);

            const newLoadedCount = fetchOffset + mappedTasks.length;
            setOffset(newLoadedCount);
            setHasMoreTasks(newLoadedCount < newTotalCount && mappedTasks.length > 0);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching tasks.";
            console.error("Task fetch error:", errorMsg);
            setTaskError(errorMsg); // Set generic error state
            toast.error(`Failed to load tasks: ${errorMsg}`); // Show toast notification

            if (isInitialLoad) {
                 setInitialTaskLoadError(errorMsg); // Set specific initial load error
                 setTasks([]); // Ensure tasks are empty on initial load failure
                 setHasMoreTasks(false); // Stop pagination if initial load fails
            } else {
                 // If fetching *more* tasks failed, keep existing tasks but stop loading more for now
                 setHasMoreTasks(false);
            }
        } finally {
             if (isInitialLoad) setIsLoadingInitialTasks(false);
             setIsLoadingMore(false); // Ensure loading indicators are turned off
        }
    }, [taskActions, offset, isLoadingMore, hasMoreTasks, tasks.length]);

    // Fetch Statuses Action (Updated Error Handling)
    const fetchStatuses = React.useCallback(async () => {
        setIsLoadingStatuses(true);
        setStatusFetchError(null);
        setAvailableStatuses([]); // Clear statuses before fetch

        try {
            const result = await taskActions.unique('status');
            if (Array.isArray(result)) {
                // Filter out null/undefined and ensure unique values
                const uniqueStatuses = [...Array.from(new Set(result.filter(s => s != null)))];
                setAvailableStatuses(uniqueStatuses);
            } else {
                // Assuming ResponseProps indicates an error
                throw new Error(result.detail || "Failed to fetch statuses.");
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred fetching statuses.";
            console.error("Status fetch error:", errorMsg);
            setStatusFetchError(errorMsg); // Set error state for the filter component
            setAvailableStatuses([]); // Ensure statuses are empty on error
            toast.error(`Failed to load task statuses: ${errorMsg}`); // Show toast
        } finally {
            setIsLoadingStatuses(false); // Ensure loading indicator is off
        }
    }, [taskActions]);

    // Update Assistant Profile Action (Error handled by caller via throw + toast)
    const updateAssistantProfile = React.useCallback(async (id: string, about: string | null, phone: string | null, email: string | null): Promise<ResponseProps> => {
        try {
            const result = await assistantActions.assistant.update(id, about, phone, email);
             if (result && 'detail' in result) {
                 throw new Error((result as ResponseProps).detail);
             }

            // Optimistic update only on API success - fetch updated signed URL
            const updatedAssistant = assistants.find(a => a.agent_id === id);
            let signedProfilePhotoUrl = updatedAssistant?.signedProfilePhotoUrl; // Keep existing if no change needed
            if (updatedAssistant && isGcsPhoto(updatedAssistant.profile_photo) && !signedProfilePhotoUrl) {
                // If photo exists but URL is missing (e.g., after error), try fetching it again
                try {
                    const photoResult = await assistantActions.photo.download(updatedAssistant.profile_photo);
                    signedProfilePhotoUrl = photoResult.signedUrl; // Update signed URL
                } catch (photoError) {
                    console.warn(`[Main.tsx updateAssistantProfile] Could not refresh signed URL for ${id} after update.`, photoError)
                }
            }


            setAssistants((prevAssistants) =>
                prevAssistants.map((assistant) =>
                    assistant.agent_id === id ? { ...assistant, about, phone, email, signedProfilePhotoUrl } : assistant
                )
            );
             return { info: "Profile updated successfully" };

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error("Assistant update error:", errorMsg);
            // Don't necessarily refetch all here, let the toast inform the user
            // Consider refetching just the affected assistant if granular fetch is possible
            throw error; // Re-throw for the caller (AssistantProfilePanel) to show toast
        }
    }, [assistantActions, assistants]); // Added `assistants` to dependencies for signed URL logic

    // Delete Assistant Action (Error handled via toast)
    const handleDeleteAssistant = React.useCallback(async (assistantToDelete: Assistant) => {
        const assistantId = assistantToDelete.agent_id;
        const displayName = `${assistantToDelete.first_name} ${assistantToDelete.surname}`;
        const photoPath = assistantToDelete.profile_photo;
        const isGcs = isGcsPhoto(photoPath);
        const toastId = toast.loading(`Ending contract for ${displayName}...`);

        try {
            // Step 1: Delete assistant record via API
            const deleteResult = await assistantActions.assistant.delete(assistantId);
             if (deleteResult.detail) {
                 throw new Error(deleteResult.detail || "Failed to delete assistant record.");
             }

            // Step 2: Attempt GCS photo deletion
            if (isGcs && photoPath) {
                 try {
                     const photoDeleteResult = await assistantActions.photo.delete(photoPath);
                     if (!photoDeleteResult.info) {
                         // Log warning but don't block UI update for photo deletion failure
                         console.warn(`[Main.tsx handleDeleteAssistant] Could not delete profile photo for ${displayName} (ID: ${assistantId}). Path: ${photoPath}`, { description: photoDeleteResult.detail });
                     }
                 } catch (photoError: any) {
                     console.error(`[Main.tsx handleDeleteAssistant] Error during GCS photo deletion for ${displayName} (ID: ${assistantId}):`, photoError);
                 }
            }

            // Step 3: Update UI state (remove assistant, close panel) on success of main deletion
            setAssistants((prev) => prev.filter((a) => a.agent_id !== assistantId));
            handleProfileClose(); // Close the profile panel
            toast.success(`${displayName} removed from team.`, { id: toastId });

            // Step 4: Clear assistant filter if the deleted assistant was the only one selected
            setAssignedFilter(prev => prev.filter(id => id !== assistantId));


        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`[Main.tsx handleDeleteAssistant] Error during deletion process for ${displayName}:`, errorMsg);
            toast.error(`Failed to remove ${displayName}: ${errorMsg}`, { id: toastId });
            // Re-throw the error so the Profile Panel knows deletion failed and can keep the dialog open etc.
            throw error;
        }
    }, [assistantActions, setAssistants, setAssignedFilter]); // Added setAssignedFilter

    // Effect 1: Fetch assistants and statuses on mount
    React.useEffect(() => {
        fetchAssistants();
        fetchStatuses();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // fetchAssistants and fetchStatuses are memoized

    // Effect 2: Fetch tasks based on filters AFTER assistants have finished loading (or failed)
    React.useEffect(() => {
        // Wait until the assistant loading attempt is complete (isLoadingAssistants is false)
        if (isLoadingAssistants) return;

        // Build the filter expression based on current state
        const newFilterExpr = buildFilterExpression(debouncedSearchTerm, statusFilter, assignedFilter);

        // Trigger initial fetch IF:
        // 1. It hasn't been triggered yet OR
        // 2. The filter expression has changed since the last fetch
        if (!initialTaskFetchTriggered || newFilterExpr !== currentFilterExpr) {
            fetchTasks(newFilterExpr, true); // `true` indicates it's an initial load for these filters
            if (!initialTaskFetchTriggered) {
                 setInitialTaskFetchTriggered(true); // Mark that the first fetch attempt has happened
            }
        }
    }, [
        fetchTasks, // Memoized fetch function
        isLoadingAssistants, // Trigger when assistant loading finishes
        initialTaskFetchTriggered, // Ensure it runs at least once
        debouncedSearchTerm, // Trigger on search term change
        statusFilter, // Trigger on status filter change
        assignedFilter, // Trigger on assigned filter change
        currentFilterExpr // Trigger if the effective filter expression changes
    ]);


    // Callback for TaskList infinite scroll
    const fetchMoreTasks = React.useCallback(() => {
        // Only fetch more if:
        // - Not already loading more tasks
        // - There are potentially more tasks to load
        // - The initial task load did not fail
        if (!isLoadingMore && hasMoreTasks && !initialTaskLoadError) {
             fetchTasks(currentFilterExpr, false); // `false` indicates it's fetching the next page
        }
    }, [fetchTasks, isLoadingMore, hasMoreTasks, initialTaskLoadError, currentFilterExpr]);

    // UI Handlers (Unchanged)
    const handleChat = (id: string) => { setChatTargetAssistantId(id); setIsChatOpen(true); if (isProfileOpen && profileAssistantId !== id) { setIsProfileOpen(false); setProfileAssistantId(null); } };
    const handleChatClose = () => setIsChatOpen(false);
    const handleShowProfile = (id: string) => { if (isProfileOpen && profileAssistantId === id) { setIsProfileOpen(false); setProfileAssistantId(null); } else { setProfileAssistantId(id); setIsProfileOpen(true); if (isChatOpen && chatTargetAssistantId !== id) setIsChatOpen(false); } };
    const handleProfileClose = () => { setIsProfileOpen(false); setProfileAssistantId(null); };

    // Memoized Assistants for lookup (Unchanged)
    const chatAssistant = React.useMemo(() => assistants.find(a => a.agent_id === chatTargetAssistantId) || null, [assistants, chatTargetAssistantId]);
    const profileAssistant = React.useMemo(() => assistants.find(a => a.agent_id === profileAssistantId) || null, [assistants, profileAssistantId]);

    // Combined initial loading state for TaskList (true if either assistants OR initial tasks are loading)
    const isCombinedLoadingInitial = isLoadingAssistants || isLoadingInitialTasks;

    // --- Render Logic ---

    return (
        <>
        {/* Toaster for notifications */}
        <Toaster richColors position="bottom-right" closeButton />

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
                    onOpenHireDialog={handleOpenHireDialog}
                />
            </div>

            {/* Assistant Profile Panel (Animated) */}
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
                    isLoadingInitial={isCombinedLoadingInitial}
                    initialLoadError={initialTaskLoadError}
                    allAssistants={assistants}
                    searchTerm={searchTermInput}
                    setSearchTerm={setSearchTermInput}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    assignedFilter={assignedFilter}
                    setAssignedFilter={setAssignedFilter}
                    updateTask={taskActions.update}
                    onTaskUpdate={handleTaskUpdate}
                    availableStatuses={availableStatuses}
                    isLoadingStatuses={isLoadingStatuses}
                    statusFetchError={statusFetchError}
                 />
            </div>
        </div>

        {/* Hire Assistant Dialog */}
        <Dialog open={isHireDialogOpen} onOpenChange={setIsHireDialogOpen}>
             <DialogContent className={cn(
                "max-w-4xl h-[85vh] flex flex-col p-0 gap-0",
                 isAssistantPresetsOpen && "max-w-6xl" // Expand width when presets are open
             )} onInteractOutside={(e) => { if (isHireSubmitting) e.preventDefault(); }}> {/* Prevent closing during submit */}
                 <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle>Hire New Assistant</DialogTitle>
                    <DialogDescription>Define the profile for your new team member. Select a preset or fill out the details.</DialogDescription>
                </DialogHeader>

                {/* Main Content Area: Form and Presets */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Hire Form Area */}
                    <div className={cn(
                        "flex-1 h-full min-w-0 relative transition-all duration-300 ease-in-out",
                        "pl-6 pr-14 py-4 overflow-y-auto"
                    )}>
                        <Button
                            variant="outline"
                            size="icon"
                            className="absolute top-4 right-4 z-10 w-8 h-8"
                            onClick={() => setIsAssistantPresetsOpen(prev => !prev)}
                            aria-label="Toggle available hires"
                            disabled={isHireSubmitting}
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                         <HireForm
                            formMethods={hireFormMethods}
                            onSubmit={handleHireFormSubmit}
                            onImageRemove={handleHireImageRemove}
                            isSubmitting={isHireSubmitting}
                        />
                    </div>

                     {/* Presets Panel (Conditional Render within Dialog) */}
                     {isAssistantPresetsOpen && (
                        <motion.div
                            key="hire-presets-panel"
                            initial={{ width: "0%", opacity: 0 }}
                            animate={{ width: "40%", opacity: 1 }}
                            exit={{ width: "0%", opacity: 0 }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                            className="h-full flex-shrink-0 overflow-hidden bg-background"
                        >
                            <PresetsPanel
                                presets={sampledPresets}
                                onPresetSelect={handleAssistantPresetSelect}
                                onClose={() => setIsAssistantPresetsOpen(false)}
                            />
                        </motion.div>
                     )}
                 </div>

                 {/* Dialog Footer with Actions */}
                 <DialogFooter className="px-6 py-3 border-t flex-shrink-0">
                     <DialogClose asChild>
                         <Button type="button" variant="outline" disabled={isHireSubmitting}>
                             Cancel
                         </Button>
                     </DialogClose>
                     {/* Trigger form submission using the form's submit button simulation */}
                     <Button
                        type="button" // Not type="submit" as it's outside the form element
                        onClick={hireFormMethods.handleSubmit(handleHireFormSubmit)} // Manually trigger RHF submit
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={isHireSubmitting}
                    >
                        {isHireSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Hiring...
                            </>
                        ) : "Hire Assistant" }
                    </Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}