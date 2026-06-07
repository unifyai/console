import * as React from 'react';
import { VoiceOption, Voice, AssistantActions } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { SupportedLanguage, Gender as CartesiaGender } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { fetchVoices } from '@/lib/client/voice';
import {
  applyApprovedCharacterVoiceMetadata,
  approvedCharacterVoiceIds,
} from '@/constants/assistants/approved_character_voices';

interface UseVoiceOptionsConfig {
  /**
   * Whether to enable automatic fetching of user voices.
   * When false, voices will only be fetched when manually calling fetchUserVoices().
   * Defaults to true for backward compatibility.
   */
  enabled?: boolean;
}

export function useVoiceOptions(
  assistantVoiceActions: AssistantActions['voice'],
  options?: UseVoiceOptionsConfig
) {
  // Default to enabled=true for backward compatibility
  const enabled = options?.enabled ?? true;

  const [presetVoices] = React.useState<VoiceOption[]>(() => {
    const allPresets = voicePresetsConstant as Voice[];
    // Filter presets based on the PRIMARY_VOICE_PROVIDER setting
    const filteredPresets = allPresets.filter(
      (preset) => preset.provider === PRIMARY_VOICE_PROVIDER
    );
    return filteredPresets.map((vp) => ({
      ...vp,
      voiceId: vp.voiceId,
      language: vp.language as SupportedLanguage,
      gender: vp.gender as CartesiaGender,
      provider: vp.provider,
      isPreset: true,
      isUserVoiceInOrchestra: false,
    }));
  });

  const [userVoicesFromOrchestra, setUserVoicesFromOrchestra] = React.useState<VoiceOption[]>([]);
  const [isLoadingUserVoices, setIsLoadingUserVoices] = React.useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(false);

  const fetchUserVoicesFromOrchestra = React.useCallback(async () => {
    setIsLoadingUserVoices(true);
    try {
      const result = await fetchVoices();
      if (Array.isArray(result)) {
        // Also filter user's voices from DB if their provider doesn't match PRIMARY_VOICE_PROVIDER
        // This might be too restrictive if a user has old voices from a different provider
        // For now, let's assume voices in DB are valid regardless of current PRIMARY_VOICE_PROVIDER setting,
        // or that the backend /assistant/voice list already filters by active provider if necessary.
        // The main goal here is to filter the *presets*.
        // If user voices from DB should also be filtered by current PRIMARY_VOICE_PROVIDER, add filter here:
        // .filter(v => v.provider === PRIMARY_VOICE_PROVIDER)
        setUserVoicesFromOrchestra(
          result.map((v) => ({
            ...v,
            provider: v.provider || PRIMARY_VOICE_PROVIDER,
            isUserVoiceInOrchestra: true,
            isPreset: v.isPreset ?? false,
          }))
        );
      } else {
        const errorResult = result as ResponseProps;
        setUserVoicesFromOrchestra([]);
      }
    } catch (error: any) {
      setUserVoicesFromOrchestra([]);
    } finally {
      setIsLoadingUserVoices(false);
      setHasFetchedOnce(true);
    }
  }, []);

  // Auto-fetch when enabled becomes true AND we haven't fetched yet
  React.useEffect(() => {
    if (enabled && !hasFetchedOnce) {
      fetchUserVoicesFromOrchestra();
    }
  }, [enabled, hasFetchedOnce, fetchUserVoicesFromOrchestra]);

  const allDisplayableVoices = React.useMemo(() => {
    const orchestraVoiceIds = new Set(userVoicesFromOrchestra.map((uv) => uv.voiceId));

    const combined = [...userVoicesFromOrchestra];

    presetVoices.forEach((pv) => {
      if (!orchestraVoiceIds.has(pv.voiceId)) {
        combined.push(pv);
      }
    });

    const finalMap = new Map<string, VoiceOption>();
    combined.forEach((voice) => {
      if (!finalMap.has(voice.voiceId)) {
        finalMap.set(voice.voiceId, voice);
      } else {
        const existing = finalMap.get(voice.voiceId)!;
        if (voice.isUserVoiceInOrchestra && !existing.isUserVoiceInOrchestra) {
          finalMap.set(voice.voiceId, voice);
        }
      }
    });

    const finalCombined = Array.from(finalMap.values())
      .filter((voice) => approvedCharacterVoiceIds.has(voice.voiceId))
      .map(applyApprovedCharacterVoiceMetadata);

    return finalCombined;
  }, [presetVoices, userVoicesFromOrchestra]);

  const deleteUserVoice = async (voiceToDelete: VoiceOption): Promise<string | null> => {
    if (voiceToDelete.isPreset || !voiceToDelete.isUserVoiceInOrchestra || !voiceToDelete.voiceId) {
      toast.error('This voice cannot be deleted.');
      return null;
    }

    const toastId = toast.loading(`Deleting voice "${voiceToDelete.name}"...`);
    try {
      const deleteResult = await assistantVoiceActions.delete(
        voiceToDelete.voiceId,
        voiceToDelete.provider
      );
      if (deleteResult.detail) {
        toast.error(`Error deleting voice}`, { id: toastId });
        return null;
      }

      toast.success(`Voice "${voiceToDelete.name}" deleted.`, { id: toastId });
      fetchUserVoicesFromOrchestra();
      return voiceToDelete.voiceId;
    } catch (error: any) {
      toast.error(`Error deleting voice`, { id: toastId });
      return null;
    }
  };

  return {
    allDisplayableVoices,
    isLoadingUserVoices,
    fetchUserVoices: fetchUserVoicesFromOrchestra,
    deleteUserVoice,
    /** Whether user voices have been fetched at least once */
    hasFetchedOnce,
  };
}
