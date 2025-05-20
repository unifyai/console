'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Team/AssistantList";
import { TaskList } from "@/components/Team/TaskList";
import { cn } from '@/lib/utils';
import { Assistant, AssistantActions, AssistantFormData, AssistantPreset, Voice, VoicePreset as VoicePresetType } from "@/types/team/assistant"; // Updated imports
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
import assistantPresetsConstant from "@/constants/assistants/assistant_presets.js";
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { LayoutList, Loader2, Shuffle, X } from 'lucide-react';

const TASK_PAGE_LIMIT = 20;
const PRESETS_PAGE_LIMIT = 12;

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

// Helper to shuffle presets
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Preset Age Brackets
const PRESET_AGE_BRACKETS = ['all', '18-25', '26-35', '36-45', '46-55', '56+'];

interface MainProps {
    taskActions: TaskActions;
    assistantActions: AssistantActions;
}

export default function Main({ taskActions, assistantActions }: MainProps) {
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
    const [taskError, setTaskError] = React.useState<string | null>(null); 
    const [initialTaskLoadError, setInitialTaskLoadError] = React.useState<string | null>(null); 
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
    
    // Hire Form Hook
    const hireFormMethods = useForm<AssistantFormData>({
        defaultValues: {
            first_name: '', surname: '', age: null, region: null, about: null,
            imageFile: null, imagePreview: null,
            voice_id: (voicePresetsConstant as VoicePresetType[])[0]?.id || null, 
        },
    });
    const { setValue: setHireValue, watch: watchHireForm, reset: resetHireForm, getValues: getHireValues, setError: setHireError, clearErrors: clearHireErrors } = hireFormMethods;

    // --- Assistant Presets State & Logic ---
    const [allAssistantPresets] = React.useState<AssistantPreset[]>(() => shuffleArray(assistantPresetsConstant as AssistantPreset[]));
    
    const [presetAgeFilter, setPresetAgeFilter] = React.useState<string>('all');
    const [presetRegionFilter, setPresetRegionFilter] = React.useState<string>('all');
    const [presetGenderFilter, setPresetGenderFilter] = React.useState<string>('all');

    const [uniquePresetRegions, setUniquePresetRegions] = React.useState<string[]>(['all']);
    const [uniquePresetGenders, setUniquePresetGenders] = React.useState<string[]>(['all']);

    const [currentFilteredPresets, setCurrentFilteredPresets] = React.useState<AssistantPreset[]>([]);
    const [displayedPresets, setDisplayedPresets] = React.useState<AssistantPreset[]>([]);
    const [presetsToShowCount, setPresetsToShowCount] = React.useState<number>(PRESETS_PAGE_LIMIT);
    const [isLoadingMorePresets, setIsLoadingMorePresets] = React.useState(false);

    React.useEffect(() => {
        const regions = ['all', ...Array.from(new Set(allAssistantPresets.map(p => p.region).filter(Boolean))) as string[]];
        const genders = ['all', ...Array.from(new Set(allAssistantPresets.map(p => p.gender).filter(Boolean))) as string[]];
        setUniquePresetRegions(regions.sort());
        setUniquePresetGenders(genders.sort((a,b) => a.localeCompare(b)));
    }, [allAssistantPresets]);

    React.useEffect(() => {
        let filtered = [...allAssistantPresets];

        // Age Filter
        if (presetAgeFilter !== 'all' && presetAgeFilter) {
            const [minAgeStr, maxAgeStr] = presetAgeFilter.split('-');
            const minAge = parseInt(minAgeStr, 10);
            const maxAge = maxAgeStr ? parseInt(maxAgeStr, 10) : Infinity;
            filtered = filtered.filter(p => p.age && p.age >= minAge && p.age <= maxAge);
        }

        // Region Filter
        if (presetRegionFilter !== 'all' && presetRegionFilter) {
            filtered = filtered.filter(p => p.region === presetRegionFilter);
        }

        // Gender Filter
        if (presetGenderFilter !== 'all' && presetGenderFilter) {
            filtered = filtered.filter(p => p.gender?.toLowerCase() === presetGenderFilter.toLowerCase());
        }
        
        setCurrentFilteredPresets(filtered);
        setPresetsToShowCount(PRESETS_PAGE_LIMIT); // Reset count when filters change
    }, [allAssistantPresets, presetAgeFilter, presetRegionFilter, presetGenderFilter]);

    React.useEffect(() => {
        setDisplayedPresets(currentFilteredPresets.slice(0, presetsToShowCount));
    }, [currentFilteredPresets, presetsToShowCount]);

    const loadMorePresets = React.useCallback(() => {
        if (isLoadingMorePresets || presetsToShowCount >= currentFilteredPresets.length) return;
        
        setIsLoadingMorePresets(true);
        // Simulate loading delay for smoother UX if needed, otherwise remove setTimeout
        setTimeout(() => {
            setPresetsToShowCount(prevCount => Math.min(prevCount + PRESETS_PAGE_LIMIT, currentFilteredPresets.length));
            setIsLoadingMorePresets(false);
        }, 300); 
    }, [isLoadingMorePresets, presetsToShowCount, currentFilteredPresets.length]);

    const canLoadMorePresets = displayedPresets.length < currentFilteredPresets.length;

    const handleRandomizePreset = () => {
        if (currentFilteredPresets.length === 0) {
            toast.info("No presets match the current filters to pick from.", { duration: 3000 });
            return;
        }
        const randomIndex = Math.floor(Math.random() * currentFilteredPresets.length);
        const randomPreset = currentFilteredPresets[randomIndex];
        if (randomPreset) {
            handleAssistantPresetSelect(randomPreset);
        }
    };

    // --- Hire Dialog Logic ---
    React.useEffect(() => {
        const subscription = watchHireForm(() => {});
        return () => subscription.unsubscribe();
    }, [watchHireForm]);
    
    const handleOpenHireDialog = React.useCallback(() => {
        const defaultVoice = (voicePresetsConstant as VoicePresetType[])[0];
        resetHireForm({
            first_name: '', surname: '', age: null, region: null, about: null,
            imageFile: null, imagePreview: null,
            voice_id: defaultVoice?.id || null,
        });
        setIsAssistantPresetsOpen(true); 
        // Reset preset filters to default when opening dialog
        setPresetAgeFilter('all');
        setPresetRegionFilter('all');
        setPresetGenderFilter('all');
        // Auto populate hire dialog with an assistant preset on dialog open
        if (allAssistantPresets.length > 0) {
            const presetsToChooseFrom = allAssistantPresets; 
            const randomIndex = Math.floor(Math.random() * presetsToChooseFrom.length);
            const randomPreset = presetsToChooseFrom[randomIndex];
            if (randomPreset) {
                handleAssistantPresetSelect(randomPreset);
            }
        }
        // Initial load of presets for the dialog will be handled by effects
        setIsHireDialogOpen(true);
    }, [resetHireForm, setIsAssistantPresetsOpen, setPresetAgeFilter, setPresetRegionFilter, setIsHireDialogOpen, allAssistantPresets]);

    const handleHireImageRemove = React.useCallback(() => {
        const currentPreview = getHireValues("imagePreview");
        if (currentPreview && currentPreview.startsWith('blob:')) {
            URL.revokeObjectURL(currentPreview);
        }
        setHireValue("imageFile", null);
        setHireValue("imagePreview", null);
    }, [getHireValues, setHireValue]);

    const handleAssistantPresetSelect = React.useCallback((preset: AssistantPreset) => {
        handleHireImageRemove(); 
        setHireValue("first_name", preset.first_name, { shouldValidate: true });
        setHireValue("surname", preset.surname, { shouldValidate: true });
        setHireValue("age", preset.age, { shouldValidate: true });
        setHireValue("region", preset.region, { shouldValidate: true });
        setHireValue("about", preset.about, { shouldValidate: true });
        setHireValue("imagePreview", preset.profile_photo);
        setHireValue("voice_id", preset.voice_id);
        clearHireErrors();
    }, [handleHireImageRemove, setHireValue, clearHireErrors]);

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
                    const errorMsg = createImageResult.detail;
                    console.error("Error from createImage action:", createImageResult);
                    toast.error(errorMsg, { id: toastId });
                    setIsHireSubmitting(false);
                    return;
                }

                const successResult = createImageResult as { signedUrl: string, filePath: string, bucketName: string };
                const { signedUrl, filePath: returnedFilePath, bucketName: returnedBucketName } = successResult;

                const uploadSuccess = await uploadImageToGCS(imageFile, signedUrl);
                if (!uploadSuccess) {
                    setIsHireSubmitting(false);
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
                finalImageUrlToSend = data.imagePreview;
            }

            if (!finalImageUrlToSend && !(imageFile instanceof File) && !data.imagePreview /* check if imagePreview was from a preset */) {
                 setHireError("imageFile", { type: "manual", message: "Profile photo is required." });
                 toast.error("Profile photo is required.", { id: toastId });
                 setIsHireSubmitting(false);
                 return;
            }

            const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
            if (!ageNumber || isNaN(ageNumber) || ageNumber <= 0) {
                setHireError("age", { type: "manual", message: "Valid age is required." });
                toast.error("Invalid age provided.", { id: toastId });
                setIsHireSubmitting(false);
                return;
            }
            if (!data.voice_id) {
                setHireError("voice_id", { type: "manual", message: "No voice id provided." });
                toast.error("No voice selected.", { id: toastId }); setIsHireSubmitting(false); return;
            }

            const result = await assistantActions.assistant.create(data.first_name, data.surname, ageNumber, data.region, finalImageUrlToSend, data.about, data.voice_id
            );

            if ("info" in result) {
                toast.success(`Assistant ${data.first_name} ${data.surname} hired!`, { id: toastId, duration: 4000 });
                setIsHireDialogOpen(false); 
                await fetchAssistants(false);
                const newAssistant = result.assistant as Assistant 
                handleShowProfile(newAssistant.agent_id);
            } else {
                const errorResult = result as ResponseProps;
                const errorMessage = errorResult?.detail || "Failed to hire assistant.";
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
                    ? { ...task, ...updatedFields } 
                    : task
            )
        );
    }, []);

    // --- Data Fetching & Actions ---

    const fetchAssistants = React.useCallback(async (showLoadingToast = false) => {
        setIsLoadingAssistants(true);
        setAssistantError(null);
        setAssistants([]); 

        let toastId: string | number | undefined;
        if (showLoadingToast) {
            toastId = toast.loading("Refreshing assistants...");
        }

        try {
            const listResult = await assistantActions.assistant.list();

            if (typeof listResult === 'object' && listResult !== null && 'detail' in listResult && typeof (listResult as ResponseProps).detail === 'string') {
                throw new Error((listResult as ResponseProps).detail);
            }
            if (!Array.isArray(listResult)) {
                 const detail = (typeof listResult === 'object' && listResult !== null && 'detail' in listResult) ? (listResult as any).detail : "Invalid response format";
                 throw new Error(`Invalid response format received for assistants: ${detail}`);
            }

            const validAssistants = listResult.filter(a => a && a.agent_id && a.first_name && a.surname);
            if (validAssistants.length !== listResult.length) {
                console.warn("Some assistant data was incomplete and filtered out.");
            }

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
            if (toastId) toast.dismiss(toastId);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching assistants.";
            console.error("Assistant fetch error:", errorMsg);
            setAssistantError(errorMsg); 
            setAssistants([]); 
            toast.error(`Failed to load assistants: ${errorMsg}`, { id: toastId });
        } finally {
            setIsLoadingAssistants(false); 
        }
    }, [assistantActions]);

    const fetchTasks = React.useCallback(async (filterExpr: string | null, isInitialLoad = true) => {
        if (!isInitialLoad && isLoadingMore) return;

        const fetchOffset = isInitialLoad ? 0 : offset;

        if (isInitialLoad) {
            setIsLoadingInitialTasks(true);
            setTasks([]); 
            setOffset(0); 
            setHasMoreTasks(true); 
            setCurrentFilterExpr(filterExpr); 
            setTaskError(null); 
            setInitialTaskLoadError(null); 
        } else {
             if (!hasMoreTasks) return; 
             setIsLoadingMore(true);
             setTaskError(null); 
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
            setTaskError(errorMsg); 
            toast.error(`Failed to load tasks: ${errorMsg}`); 

            if (isInitialLoad) {
                 setInitialTaskLoadError(errorMsg); 
                 setTasks([]); 
                 setHasMoreTasks(false); 
            } else {
                 setHasMoreTasks(false);
            }
        } finally {
             if (isInitialLoad) setIsLoadingInitialTasks(false);
             setIsLoadingMore(false); 
        }
    }, [taskActions, offset, isLoadingMore, hasMoreTasks, tasks.length]);

    const fetchStatuses = React.useCallback(async () => {
        setIsLoadingStatuses(true);
        setStatusFetchError(null);
        setAvailableStatuses([]); 

        try {
            const result = await taskActions.unique('status');
            if (Array.isArray(result)) {
                const uniqueStatuses = [...Array.from(new Set(result.filter(s => s != null)))];
                setAvailableStatuses(uniqueStatuses);
            } else {
                throw new Error(result.detail || "Failed to fetch statuses.");
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred fetching statuses.";
            console.error("Status fetch error:", errorMsg);
            setStatusFetchError(errorMsg); 
            setAvailableStatuses([]); 
            toast.error(`Failed to load task statuses: ${errorMsg}`); 
        } finally {
            setIsLoadingStatuses(false); 
        }
    }, [taskActions]);

    const updateAssistantProfile = React.useCallback(async (id: string, about: string | null, phone: string | null, email: string | null): Promise<ResponseProps> => {
        try {
            const result = await assistantActions.assistant.update(id, about, phone, email, null);
             if (result && 'detail' in result) {
                 throw new Error((result as ResponseProps).detail);
             }
            
            const updatedAssistant = assistants.find(a => a.agent_id === id);
            let signedProfilePhotoUrl = updatedAssistant?.signedProfilePhotoUrl; 
            if (updatedAssistant && isGcsPhoto(updatedAssistant.profile_photo) && !signedProfilePhotoUrl) {
                try {
                    const photoResult = await assistantActions.photo.download(updatedAssistant.profile_photo);
                    signedProfilePhotoUrl = photoResult.signedUrl; 
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
            throw error; 
        }
    }, [assistantActions, assistants]); 

    const handleDeleteAssistant = React.useCallback(async (assistantToDelete: Assistant) => {
        const assistantId = assistantToDelete.agent_id;
        const displayName = `${assistantToDelete.first_name} ${assistantToDelete.surname}`;
        const photoPath = assistantToDelete.profile_photo;
        const isGcs = isGcsPhoto(photoPath);
        const toastId = toast.loading(`Ending contract for ${displayName}...`);

        try {
            const deleteResult = await assistantActions.assistant.delete(assistantId);
             if (deleteResult.detail) {
                 throw new Error(deleteResult.detail || "Failed to delete assistant record.");
             }

            if (isGcs && photoPath) {
                 try {
                     const photoDeleteResult = await assistantActions.photo.delete(photoPath);
                     if (!photoDeleteResult.info) {
                         console.warn(`[Main.tsx handleDeleteAssistant] Could not delete profile photo for ${displayName} (ID: ${assistantId}). Path: ${photoPath}`, { description: photoDeleteResult.detail });
                     }
                 } catch (photoError: any) {
                     console.error(`[Main.tsx handleDeleteAssistant] Error during GCS photo deletion for ${displayName} (ID: ${assistantId}):`, photoError);
                 }
            }

            setAssistants((prev) => prev.filter((a) => a.agent_id !== assistantId));
            handleProfileClose(); 
            toast.success(`${displayName} removed from team.`, { id: toastId });

            setAssignedFilter(prev => prev.filter(id => id !== assistantId));

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`[Main.tsx handleDeleteAssistant] Error during deletion process for ${displayName}:`, errorMsg);
            toast.error(`Failed to remove ${displayName}: ${errorMsg}`, { id: toastId });
            throw error;
        }
    }, [assistantActions, setAssistants, setAssignedFilter]); 

    React.useEffect(() => {
        fetchAssistants();
        fetchStatuses();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    const initialLoadProcessedRef = React.useRef(false);
    React.useEffect(() => {
        if (!isLoadingAssistants && !initialLoadProcessedRef.current) {
            initialLoadProcessedRef.current = true; 
    
            if (!assistantError && assistants.length === 0) {
                handleOpenHireDialog();
            }
        }
    }, [assistants, isLoadingAssistants, assistantError, handleOpenHireDialog]);

    React.useEffect(() => {
        if (isLoadingAssistants) return;
        const newFilterExpr = buildFilterExpression(debouncedSearchTerm, statusFilter, assignedFilter);
        if (!initialTaskFetchTriggered || newFilterExpr !== currentFilterExpr) {
            fetchTasks(newFilterExpr, true); 
            if (!initialTaskFetchTriggered) {
                 setInitialTaskFetchTriggered(true); 
            }
        }
    }, [
        fetchTasks, 
        isLoadingAssistants, 
        initialTaskFetchTriggered, 
        debouncedSearchTerm, 
        statusFilter, 
        assignedFilter, 
        currentFilterExpr 
    ]);

    const fetchMoreTasks = React.useCallback(() => {
        if (!isLoadingMore && hasMoreTasks && !initialTaskLoadError) {
             fetchTasks(currentFilterExpr, false); 
        }
    }, [fetchTasks, isLoadingMore, hasMoreTasks, initialTaskLoadError, currentFilterExpr]);

    const handleChat = (id: string) => { setChatTargetAssistantId(id); setIsChatOpen(true); if (isProfileOpen && profileAssistantId !== id) { setIsProfileOpen(false); setProfileAssistantId(null); } };
    const handleChatClose = () => setIsChatOpen(false);
    const handleShowProfile = (id: string) => { if (isProfileOpen && profileAssistantId === id) { setIsProfileOpen(false); setProfileAssistantId(null); } else { setProfileAssistantId(id); setIsProfileOpen(true); if (isChatOpen && chatTargetAssistantId !== id) setIsChatOpen(false); } };
    const handleProfileClose = () => { setIsProfileOpen(false); setProfileAssistantId(null); };

    const chatAssistant = React.useMemo(() => assistants.find(a => a.agent_id === chatTargetAssistantId) || null, [assistants, chatTargetAssistantId]);
    const profileAssistant = React.useMemo(() => assistants.find(a => a.agent_id === profileAssistantId) || null, [assistants, profileAssistantId]);

    const isCombinedLoadingInitial = isLoadingAssistants || isLoadingInitialTasks;

    return (
        <>
        <Toaster richColors position="bottom-right" closeButton />

        <div className="flex h-screen bg-background overflow-hidden">
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
                            assistantActions={assistantActions}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

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

        <Dialog open={isHireDialogOpen} onOpenChange={setIsHireDialogOpen}>
             <DialogContent className={cn(
                "max-w-4xl h-[85vh] flex flex-col p-0 gap-0",
                 isAssistantPresetsOpen && "max-w-6xl" 
             )} onInteractOutside={(e) => { if (isHireSubmitting) e.preventDefault(); }}>
                 <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle>Hire New Assistant</DialogTitle>
                    <DialogDescription>Define the profile for your new team member. Select a preset or fill out the details.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div className={cn(
                        "flex-1 h-full min-w-0 relative transition-all duration-300 ease-in-out",
                        "pl-6 pr-14 py-4 overflow-y-auto" // Added pr-14 for buttons
                    )}>
                        <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="w-8 h-8"
                                onClick={() => setIsAssistantPresetsOpen(prev => !prev)}
                                aria-label="Toggle available hires"
                                disabled={isHireSubmitting}
                                title={isAssistantPresetsOpen ? "Hide Presets" : "Show Presets"}
                            >
                                <LayoutList className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="w-8 h-8"
                                onClick={handleRandomizePreset}
                                aria-label="Randomize from presets"
                                disabled={isHireSubmitting || currentFilteredPresets.length === 0}
                                title="Randomize from Presets"
                            >
                                <Shuffle className="h-4 w-4" />
                            </Button>
                        </div>
                        <HireForm 
                            formMethods={hireFormMethods} 
                            onSubmit={handleHireFormSubmit} 
                            onImageRemove={handleHireImageRemove} 
                            isSubmitting={isHireSubmitting} 
                            assistantActions={assistantActions} 
                        />
                    </div>
                     {isAssistantPresetsOpen && (
                        <motion.div
                            key="hire-presets-panel"
                            initial={{ width: "0%", opacity: 0 }}
                            animate={{ width: "40%", opacity: 1 }} // Adjust width as needed
                            exit={{ width: "0%", opacity: 0 }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                            className="h-full flex-shrink-0 overflow-hidden bg-background" // Removed border-l, PresetsPanel has it
                        >
                            <PresetsPanel
                                displayedPresets={displayedPresets}
                                onPresetSelect={handleAssistantPresetSelect}
                                onClose={() => setIsAssistantPresetsOpen(false)}
                                onLoadMore={loadMorePresets}
                                canLoadMore={canLoadMorePresets}
                                isLoadingMore={isLoadingMorePresets}
                                ageFilter={presetAgeFilter}
                                onAgeFilterChange={setPresetAgeFilter}
                                availableAgeBrackets={PRESET_AGE_BRACKETS}
                                regionFilter={presetRegionFilter}
                                onRegionFilterChange={setPresetRegionFilter}
                                availableRegions={uniquePresetRegions}
                                genderFilter={presetGenderFilter}
                                onGenderFilterChange={setPresetGenderFilter}
                                availableGenders={uniquePresetGenders}
                            />
                        </motion.div>
                     )}
                 </div>

                 <DialogFooter className="px-6 py-3 border-t flex-shrink-0">
                     <DialogClose asChild>
                         <Button type="button" variant="outline" disabled={isHireSubmitting}>
                             Cancel
                         </Button>
                     </DialogClose>
                     <Button
                        type="button" 
                        onClick={hireFormMethods.handleSubmit(handleHireFormSubmit)} 
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