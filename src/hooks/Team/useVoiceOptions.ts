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
            isPreset: true
        }))
    );
    const [userVoicesFromOrchestra, setUserVoicesFromOrchestra] = React.useState<VoiceOption[]>([]);
    const [isLoadingUserVoices, setIsLoadingUserVoices] = React.useState(false);

    const fetchUserVoicesFromOrchestra = React.useCallback(async () => {
        setIsLoadingUserVoices(true);
        try {
            const result = await assistantVoiceActions.listVoicesFromOrchestra();
            if (Array.isArray(result)) {
                setUserVoicesFromOrchestra(result.map((v: Voice) => ({
                    ...v,
                    language: v.language as SupportedLanguage,
                    gender: v.gender as CartesiaGender,
                    isUserVoiceInOrchestra: true
                })));
            } else {
                const errorResult = result as ResponseProps;
                console.error(errorResult.detail || "Failed to load custom voices.");
                setUserVoicesFromOrchestra([]);
            }
        } catch (error: any) {
            console.error(error.message);
        } finally {
            setIsLoadingUserVoices(false);
        }
    }, [assistantVoiceActions]);

    React.useEffect(() => {
        fetchUserVoicesFromOrchestra();
    }, [fetchUserVoicesFromOrchestra]);

    const allDisplayableVoices = React.useMemo(() => {
        const combined = [...presetVoices, ...userVoicesFromOrchestra];
        // Sort presets first, then user voices by name
        combined.sort((a, b) => {
            if (a.isPreset && !b.isUserVoiceInOrchestra) return -1;
            if (!a.isPreset && b.isUserVoiceInOrchestra) return 1; // Corrected: user voices should come after presets if no other distinction
            if (a.isPreset && b.isPreset) return (a.name || '').localeCompare(b.name || '');
            if (a.isUserVoiceInOrchestra && b.isUserVoiceInOrchestra) return (a.name || '').localeCompare(b.name || '');
            return (a.name || '').localeCompare(b.name || '');
        });
        return combined;
    }, [presetVoices, userVoicesFromOrchestra]);

    const deleteUserVoice = async (voiceToDelete: VoiceOption): Promise<boolean> => {
        if (!voiceToDelete.isUserVoiceInOrchestra || !voiceToDelete.voice_id) return false;
        const toastId = toast.loading(`Deleting voice "${voiceToDelete.name}"...`);
        try {
            // Attempt to delete from Cartesia first (allow 404 as "already deleted")
            const cartesiaDeleteResult = await assistantVoiceActions.deleteVoiceFromCartesia(voiceToDelete.voice_id);
            if (cartesiaDeleteResult.detail && !(cartesiaDeleteResult.info?.includes("not found") || cartesiaDeleteResult.info?.includes("assumed already deleted"))) {
                console.error(`[useVoiceOptions.ts] Cartesia delete error: ${cartesiaDeleteResult.detail}.`, { id: toastId });
                toast.error(`Error deleting voice.`, { id: toastId });
                return false; // Decide if you want to stop or proceed to DB deletion
            }

            // Then delete from Orchestra DB
            const dbDeleteResult = await assistantVoiceActions.deleteVoiceFromOrchestra(voiceToDelete.voice_id);
            if (dbDeleteResult.detail) {
                console.error(`[useVoiceOptions.ts] DB delete error: ${dbDeleteResult.detail}.`, { id: toastId });
                toast.error(`Error deleting voice`, { id: toastId });
                return false;
            }

            toast.success(`Voice "${voiceToDelete.name}" deleted.`, { id: toastId });
            fetchUserVoicesFromOrchestra(); // Refresh list
            if (onVoiceDeleted) onVoiceDeleted(voiceToDelete.voice_id);
            return true;
        } catch (error: any) {
            console.error(`[useVoiceOptions.ts] Error deleting voice: ${error.message}`)
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