import * as React from 'react';
import { VoiceOption, Voice, AssistantActions } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
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
            if (a.is_preset && !b.is_preset) return -1;
            if (!a.is_preset && b.is_preset) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
        return finalCombined;
    }, [presetVoices, userVoicesFromOrchestra]);

    const deleteUserVoice = async (voiceToDelete: VoiceOption): Promise<boolean> => {
        if (voiceToDelete.is_preset || !voiceToDelete.isUserVoiceInOrchestra || !voiceToDelete.voice_id) {
            toast.error("This voice cannot be deleted.");
            return false;
        }

        const toastId = toast.loading(`Deleting voice "${voiceToDelete.name}"...`);
        try {
            const deleteResult = await assistantVoiceActions.delete(voiceToDelete.voice_id);
            if (deleteResult.detail) { 
                console.error(`[useVoiceOptions.ts] Voice delete error: ${deleteResult.detail}.`, { id: toastId });
                toast.error(`Error deleting voice}`, { id: toastId });
                return false;
            }

            toast.success(`Voice "${voiceToDelete.name}" deleted.`, { id: toastId });
            fetchUserVoicesFromOrchestra(); 
            if (onVoiceDeleted) onVoiceDeleted(voiceToDelete.voice_id);
            return true;
        } catch (error: any) {
            console.error(`[useVoiceOptions.ts] Error during voice deletion: ${error.message}`)
            toast.error(`Error deleting voice`, { id: toastId });
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