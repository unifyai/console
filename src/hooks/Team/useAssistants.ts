// src/hooks/useAssistants.ts
import * as React from 'react';
import { Assistant, AssistantActions } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { isGcsPhoto } from '@/utils/team/gcs-utils';

export function useAssistants(
    allActions: AssistantActions
) {
    const { assistant: assistantActions, photo: photoActions, contact: contactActions } = allActions;

    const [assistants, setAssistants] = React.useState<Assistant[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchAssistantsWithDetails = React.useCallback(async (showLoadingToast = true) => {
        
        setIsLoading(true);
        setError(null);
        // setAssistants([]); // Don't clear immediately if just refreshing

        let toastId: string | number | undefined;
        if (showLoadingToast) {
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
                    if (isGcsPhoto(assistant.profile_photo)) {
                        try {
                            const photoResult = await photoActions.download(assistant.profile_photo);
                            if (photoResult.signedUrl) {
                                return { ...assistant, signedProfilePhotoUrl: photoResult.signedUrl };
                            } else {
                                console.warn(`[useAssistants] Failed to get signed URL for ${assistant.agent_id} (${assistant.profile_photo}): ${photoResult.detail || 'Unknown error'}`);
                            }
                        } catch (fetchError) {
                            console.error(`[useAssistants] Error fetching signed URL for ${assistant.agent_id} (${assistant.profile_photo}):`, fetchError);
                        }
                    }
                    return assistant;
                })
            );
            setAssistants(assistantsWithSignedUrls);
            if (toastId) toast.dismiss(toastId);

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "An unknown error occurred while fetching assistants.";
            setError(errorMsg);
            setAssistants([]);
            console.error("Assistant fetch error in hook:", errorMsg);
            if (toastId) toast.error(`Failed to load assistants`, { id: toastId });
            else if(showLoadingToast) toast.error(`Failed to load assistants`);
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
        const photoPath = assistantToDelete.profile_photo;
        const isGcs = isGcsPhoto(photoPath);
        const assistantEmail = assistantToDelete.email;
        const assistantPhone = assistantToDelete.phone;

        const toastId = toast.loading(`Ending contract for ${displayName}...`);

        try {
            // 1. Delete the main assistant record from Orchestra
            const deleteResult = await assistantActions.delete(assistantId);
            if (deleteResult.detail) {
                throw new Error(deleteResult.detail || "Failed to delete assistant record.");
            }

            // 2. Attempt to delete email if it exists
            if (assistantEmail) {
                const emailDeleteResult = await contactActions.deleteEmail(assistantEmail);
                if (emailDeleteResult.detail) {
                    console.error(`Could not delete email ${assistantEmail} for ${displayName}: ${emailDeleteResult.detail}`);
                }
            }

            // 3. Attempt to delete phone number if it exists
            if (assistantPhone) {
                const phoneDeleteResult = await contactActions.deletePhoneNumber(assistantPhone);
                if (phoneDeleteResult.detail) {
                    console.error(`Could not delete phone ${assistantPhone} for ${displayName}: ${phoneDeleteResult.detail}`);
                }
            }

            // 4. Attempt to delete profile photo from GCS
            if (isGcs && photoPath) {
                try {
                    const photoDeleteResult = await photoActions.delete(photoPath);
                    if (photoDeleteResult.detail && !photoDeleteResult.info?.includes("not found")) {
                        console.error(`Could not delete profile photo for ${displayName} (ID: ${assistantId}). Path: ${photoPath}`, { description: photoDeleteResult.detail });
                        // Not throwing error here, as main assistant deletion was successful
                    }
                } catch (photoError: any) {
                    console.error(`Error during GCS photo deletion for ${displayName} (ID: ${assistantId}):`, photoError);
                }
            }

            // 5. Update local state
            setAssistants((prev) => prev.filter((a) => a.agent_id !== assistantId));
            toast.success(`${displayName} removed from team.`, { id: toastId });
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`[useAssistants] Error during deletion process for ${displayName}:`, errorMsg);
            toast.error(`Failed to remove ${displayName}`, { id: toastId });
            return false;
        }
    }, [assistantActions, photoActions]);

    const updateAssistantProfile = React.useCallback(async (
        id: string,
        about: string | null,
        phone: string | null,
        email: string | null,
        currentVoiceId: string | null
    ): Promise<boolean> => {
        const toastId = toast.loading("Updating profile...");
        try {
            const result = await assistantActions.update(id, about, phone, email, currentVoiceId);
            if (result && 'detail' in result && result.detail) {
                throw new Error((result as ResponseProps).detail);
            }

            setAssistants(prev => prev.map(a => {
                if (a.agent_id === id) {
                    const updatedAssistant = { ...a, about, phone, email };
                    if (isGcsPhoto(updatedAssistant.profile_photo)) {
                        photoActions.download(updatedAssistant.profile_photo).then(res => {
                            if (res.signedUrl) {
                                setAssistants(currentAssistants => currentAssistants.map(sa => sa.agent_id === id ? {...sa, signedProfilePhotoUrl: res.signedUrl} : sa));
                            }
                        }).catch(e => console.warn("Failed to refresh photo URL post-update", e));
                    }
                    return updatedAssistant;
                }
                return a;
            }));

            toast.success("Profile updated.", { id: toastId });
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Profile update failed: ${errorMsg}`, { id: toastId });
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