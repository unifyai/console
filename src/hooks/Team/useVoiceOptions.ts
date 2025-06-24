import * as React from 'react';
import { VoiceOption, Voice, AssistantActions } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { showLoadingToast, showErrorToast, showSuccessToast } from '@/components/notifications';
import { SupportedLanguage, Gender as CartesiaGender } from "@cartesia/cartesia-js/api";
import voicePresetsConstant from "@/constants/assistants/voice_presets.js";

export function useVoiceOptions(
    assistantVoiceActions: AssistantActions['voice'],
    onVoiceDeleted?: (voiceId: string) => void
) {
    const [presetVoices] = React.useState<VoiceOption[]>(
        (voicePresetsConstant as Voice[]).map(vp => ({
            ...vp,
            voice_id: vp.voice_id,
            language: vp.language as SupportedLanguage,
            gender: vp.gender as CartesiaGender,
            is_preset: true, // Presets from constant are marked as such
            isUserVoiceInOrchestra: false, // Initially, assume not in DB until confirmed by fetch
        }))
    );
    const [userVoicesFromOrchestra, setUserVoicesFromOrchestra] = React.useState<VoiceOption[]>([]);
    const [isLoadingUserVoices, setIsLoadingUserVoices] = React.useState(false);

    const fetchUserVoicesFromOrchestra = React.useCallback(async () => {
        setIsLoadingUserVoices(true);
        try {
            const result = await assistantVoiceActions.list();
            if (Array.isArray(result)) {
                setUserVoicesFromOrchestra(result.map(v => ({
                    ...v,
                    isUserVoiceInOrchestra: true, 
                    is_preset: v.is_preset ?? false,
                })));
            } else {
                const errorResult = result as ResponseProps;
                console.error(errorResult.detail || "Failed to load user voices from Orchestra.");
                setUserVoicesFromOrchestra([]);
            }
        } catch (error: any) {
            console.error("Error fetching voices from Orchestra:", error.message);
            setUserVoicesFromOrchestra([]);
        } finally {
            setIsLoadingUserVoices(false);
        }
    }, [assistantVoiceActions]);

    React.useEffect(() => {
        fetchUserVoicesFromOrchestra();
    }, [fetchUserVoicesFromOrchestra]);

    const allDisplayableVoices = React.useMemo(() => {
        const orchestraVoiceIds = new Set(userVoicesFromOrchestra.map(uv => uv.voice_id));
        const combined = [
            ...userVoicesFromOrchestra, // These are definitively in the DB
            ...presetVoices.filter(upv => !orchestraVoiceIds.has(upv.voice_id)) // Add constant presets not in DB
        ];
        const finalMap = new Map<string, VoiceOption>();
        combined.forEach(voice => {
            if (!finalMap.has(voice.voice_id)) {
                finalMap.set(voice.voice_id, voice);
            } else {
                // Prioritize DB entries if somehow a duplicate ID exists
                const existing = finalMap.get(voice.voice_id)!;
                if (voice.isUserVoiceInOrchestra && !existing.isUserVoiceInOrchestra) {
                    finalMap.set(voice.voice_id, voice);
                }
            }
        });
        const finalCombined = Array.from(finalMap.values());
        finalCombined.sort((a, b) => {
            // Primary sort: Non-presets first
            if (!a.is_preset && b.is_preset) return -1; // a (non-preset) comes before b (preset)
            if (a.is_preset && !b.is_preset) return 1;  // b (non-preset) comes before a (preset)

            // Secondary sort: Alphabetical by name
            return (a.name || '').localeCompare(b.name || '');
        });
        return finalCombined;
    }, [presetVoices, userVoicesFromOrchestra]);

    const deleteUserVoice = async (voiceToDelete: VoiceOption): Promise<boolean> => {
        if (voiceToDelete.is_preset || !voiceToDelete.isUserVoiceInOrchestra || !voiceToDelete.voice_id) {
            showErrorToast("This voice cannot be deleted.");
            return false;
        }

        const toastId = showLoadingToast(`Deleting voice "${voiceToDelete.name}"...`);
        try {
            const deleteResult = await assistantVoiceActions.delete(voiceToDelete.voice_id);
            if (deleteResult.detail) { 
                console.error(`[useVoiceOptions.ts] Voice delete error: ${deleteResult.detail}.`);
                showErrorToast(deleteResult.detail, `Error deleting voice`, toastId);
                return false;
            }

            showSuccessToast(`Voice "${voiceToDelete.name}" deleted.`, undefined, toastId);
            fetchUserVoicesFromOrchestra(); 
            if (onVoiceDeleted) onVoiceDeleted(voiceToDelete.voice_id);
            return true;
        } catch (error: any) {
            console.error(`[useVoiceOptions.ts] Error during voice deletion: ${error.message}`)
            showErrorToast(error.message, `Error deleting voice`, toastId);
            return false;
        }
    };


    return {
        allDisplayableVoices,
        isLoadingUserVoices,
        fetchUserVoices: fetchUserVoicesFromOrchestra,
        deleteUserVoice
    };
}