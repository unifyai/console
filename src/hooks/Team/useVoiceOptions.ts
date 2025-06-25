import * as React from 'react';
import { VoiceOption, Voice, AssistantActions } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { SupportedLanguage, Gender as CartesiaGender } from "@cartesia/cartesia-js/api";
import voicePresetsConstant from "@/constants/assistants/voice_presets.js";
import { VOICE_PROVIDER } from '@/constants/assistants/settings';

export function useVoiceOptions(
    assistantVoiceActions: AssistantActions['voice'],
    onVoiceDeleted?: (voiceId: string) => void
) {
    const [presetVoices] = React.useState<VoiceOption[]>(() => {
        const allPresets = voicePresetsConstant as Voice[];
        // Filter presets based on the VOICE_PROVIDER setting
        const filteredPresets = allPresets.filter(
            preset => preset.provider === VOICE_PROVIDER
        );
        return filteredPresets.map(vp => ({
            ...vp,
            voice_id: vp.voice_id,
            language: vp.language as SupportedLanguage,
            gender: vp.gender as CartesiaGender,
            provider: vp.provider,
            is_preset: true, 
            isUserVoiceInOrchestra: false, 
        }));
    });

    const [userVoicesFromOrchestra, setUserVoicesFromOrchestra] = React.useState<VoiceOption[]>([]);
    const [isLoadingUserVoices, setIsLoadingUserVoices] = React.useState(false);

    const fetchUserVoicesFromOrchestra = React.useCallback(async () => {
        setIsLoadingUserVoices(true);
        try {
            const result = await assistantVoiceActions.list();
            if (Array.isArray(result)) {
                // Also filter user's voices from DB if their provider doesn't match VOICE_PROVIDER
                // This might be too restrictive if a user has old voices from a different provider
                // For now, let's assume voices in DB are valid regardless of current VOICE_PROVIDER setting,
                // or that the backend /assistant/voice list already filters by active provider if necessary.
                // The main goal here is to filter the *presets*.
                // If user voices from DB should also be filtered by current VOICE_PROVIDER, add filter here:
                // .filter(v => v.provider === VOICE_PROVIDER)
                setUserVoicesFromOrchestra(result.map(v => ({
                    ...v,
                    provider: v.provider || VOICE_PROVIDER,
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
        // User voices from Orchestra are already potentially filtered or should be shown regardless of current preset provider setting.
        // Preset voices are now filtered at initialization.
        const orchestraVoiceIds = new Set(userVoicesFromOrchestra.map(uv => uv.voice_id));
        
        // Add user voices first
        const combined = [...userVoicesFromOrchestra];

        // Add filtered preset voices that are not already present as user voices (e.g., user registered a preset)
        presetVoices.forEach(pv => {
            if (!orchestraVoiceIds.has(pv.voice_id)) {
                combined.push(pv);
            }
        });
        
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