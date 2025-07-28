import * as React from 'react';
import { Assistant, AssistantActions, AssistantUpdatePayload } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { isGcsPhoto } from '@/utils/assistants/gcs-utils';

export function useAssistants(
    allActions: AssistantActions
) {
    const { assistant: assistantActions, photo: photoActions } = allActions;

    const [assistants, setAssistants] = React.useState<Assistant[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchAssistantsWithDetails = React.useCallback(async (shouldShowLoadingToast = true) => {

        setIsLoading(true);
        setError(null);
        // setAssistants([]); // Don't clear immediately if just refreshing

        let toastId: string | number | undefined;
        if (shouldShowLoadingToast) {
            toastId = toast.loading("Refreshing assistants...");
        }

        try {
            const listResult = await assistantActions.list();

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
                    let signedProfilePhotoUrl: string | undefined = undefined;
                    let signedProfileVideoUrl: string | undefined = undefined;

                    if (assistant.profile_photo && isGcsPhoto(assistant.profile_photo)) {
                        try {
                            const photoResult = await photoActions.download(assistant.profile_photo);
                            if (photoResult.signedUrl) {
                                signedProfilePhotoUrl = photoResult.signedUrl;
                            } else {
                                console.warn(`[useAssistants] Failed to get signed URL for photo ${assistant.agent_id} (${assistant.profile_photo}): ${photoResult.detail || 'Unknown error'}`);
                            }
                        } catch (fetchError) {
                            console.error(`[useAssistants] Error fetching signed URL for photo ${assistant.agent_id} (${assistant.profile_photo}):`, fetchError);
                        }
                    }

                    if (assistant.profile_video && isGcsPhoto(assistant.profile_video)) {
                        try {
                            const videoResult = await photoActions.download(assistant.profile_video);
                            if (videoResult.signedUrl) {
                                signedProfileVideoUrl = videoResult.signedUrl;
                            } else {
                                 console.warn(`[useAssistants] Failed to get signed URL for video ${assistant.agent_id} (${assistant.profile_video}): ${videoResult.detail || 'Unknown error'}`);
                            }
                        } catch (fetchError) {
                            console.error(`[useAssistants] Error fetching signed URL for video ${assistant.agent_id} (${assistant.profile_video}):`, fetchError);
                        }
                    }

                    return { ...assistant, signedProfilePhotoUrl, signedProfileVideoUrl };
                })
            );
            setAssistants(assistantsWithSignedUrls);

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "An unknown error occurred while fetching assistants.";
            setError(errorMsg);
            setAssistants([]);
            console.error("Assistant fetch error in hook:", errorMsg);
            if (toastId) {
                toast.error("Failed to load assistants", { id: toastId });
            } else if (shouldShowLoadingToast) {
                toast.error("Failed to load assistants", { id: toastId });
            }
        } finally {
            setIsLoading(false);
        }
    }, [assistantActions, photoActions]);


    React.useEffect(() => {
        fetchAssistantsWithDetails(false);
    }, [fetchAssistantsWithDetails]);

    const deleteAssistant = React.useCallback(async (assistantToDelete: Assistant): Promise<boolean> => {
        const assistantId = assistantToDelete.agent_id;
        const displayName = `${assistantToDelete.first_name} ${assistantToDelete.surname}`;

        const toastId = toast.loading(`Ending contract for ${displayName}...`);

        try {
            const deleteResult = await assistantActions.delete(assistantId);
            if (deleteResult.detail) {
                throw new Error(deleteResult.detail || "Failed to delete assistant record.");
            }

            setAssistants((prev) => prev.filter((a) => a.agent_id !== assistantId));
            toast.success(`${displayName} removed from team.`, { id: toastId });
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`[useAssistants] Error during deletion process for ${displayName}:`, errorMsg);
            toast.error(`Failed to remove ${displayName}`, { id: toastId });
            return false;
        }
    }, [assistantActions]);

    const updateAssistantProfile = React.useCallback(async (
        id: string,
        payload: Partial<AssistantUpdatePayload>
    ): Promise<boolean> => {
        const toastId = toast.loading("Updating profile...");
        try {
            const result = await assistantActions.update(id, payload);
            if (result && 'detail' in result && result.detail) {
                throw new Error((result as ResponseProps).detail);
            }

            setAssistants(prev => prev.map(a => {
                if (a.agent_id === id) {
                    const updatedAssistant = { ...a, ...payload };
                    if (isGcsPhoto(updatedAssistant.profile_photo)) {
                        photoActions.download(updatedAssistant.profile_photo!).then(res => { // Non-null assertion as isGcsPhoto checks for null
                            if (res.signedUrl) {
                                setAssistants(currentAssistants => currentAssistants.map(sa => sa.agent_id === id ? {...sa, signedProfilePhotoUrl: res.signedUrl} : sa));
                            }
                        }).catch(e => console.warn("Failed to refresh photo URL post-update (no photo change)", e));
                    }
                    return updatedAssistant;
                }
                return a;
            }));

            toast.success("Profile updated.", { id: toastId });
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Profile update failed`, { id: toastId });
            console.error("Assistant update error in hook:", errorMsg);
            return false;
        }
    }, [assistantActions, photoActions]);


    return {
        assistants,
        setAssistants,
        isLoading,
        error,
        refreshAssistants: fetchAssistantsWithDetails,
        deleteAssistant,
        updateAssistantProfile,
    };
}