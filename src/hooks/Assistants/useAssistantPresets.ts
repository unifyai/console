import * as React from 'react';
import { AssistantPreset, Voice } from '@/types/assistants/assistant';
import assistantPresetsConstant from '@/constants/assistants/assistant_presets.js';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';

const PRESETS_PAGE_LIMIT = 12;
const PRESET_AGE_BRACKETS = ['all', '18-25', '26-35', '36-45', '46-55', '56+'];

const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface UseAssistantPresetsConfig {
  /**
   * Whether to enable initialization of presets.
   * When false, presets will not be processed until enabled becomes true.
   * Defaults to true for backward compatibility.
   */
  enabled?: boolean;
}

export function useAssistantPresets(options?: UseAssistantPresetsConfig) {
  // Default to enabled=true for backward compatibility
  const enabled = options?.enabled ?? true;

  const [hasInitialized, setHasInitialized] = React.useState(false);
  const [allAssistantPresets, setAllAssistantPresets] = React.useState<AssistantPreset[]>([]);

  const [presetAgeFilter, setPresetAgeFilter] = React.useState<string>('all');
  const [presetNationalityFilter, setPresetNationalityFilter] = React.useState<string>('all');
  const [presetGenderFilter, setPresetGenderFilter] = React.useState<string>('all');
  const [presetLanguageFilter, setPresetLanguageFilter] = React.useState<string>('all');

  const [uniquePresetNationalities, setUniquePresetNationalities] = React.useState<string[]>([
    'all',
  ]);
  const [uniquePresetGenders, setUniquePresetGenders] = React.useState<string[]>(['all']);
  const [uniquePresetLanguages, setUniquePresetLanguages] = React.useState<string[]>(['all']);

  const [currentFilteredPresets, setCurrentFilteredPresets] = React.useState<AssistantPreset[]>([]);
  const [displayedPresets, setDisplayedPresets] = React.useState<AssistantPreset[]>([]);
  const [presetsToShowCount, setPresetsToShowCount] = React.useState<number>(PRESETS_PAGE_LIMIT);
  const [isLoadingMorePresets, setIsLoadingMorePresets] = React.useState(false);

  const allPresetVoices = React.useMemo(() => voicePresetsConstant as Voice[], []);

  // Initialize presets when enabled becomes true (and not already initialized)
  React.useEffect(() => {
    if (enabled && !hasInitialized) {
      const shuffledPresets = shuffleArray(
        assistantPresetsConstant.filter(
          (assistant) => assistant.voiceIds[PRIMARY_VOICE_PROVIDER]
        ) as AssistantPreset[]
      );
      setAllAssistantPresets(shuffledPresets);
      setHasInitialized(true);
    }
  }, [enabled, hasInitialized]);

  const presetsWithLanguage = React.useMemo(() => {
    if (!hasInitialized) return [];

    return allAssistantPresets.map((preset) => {
      const voiceId = preset.voiceIds[PRIMARY_VOICE_PROVIDER];
      const voice = allPresetVoices.find((v) => v.voiceId === voiceId);
      return {
        ...preset,
        language: voice?.language || null,
      };
    });
  }, [allAssistantPresets, allPresetVoices, hasInitialized]);

  // Compute unique filter values only after initialization
  React.useEffect(() => {
    if (!hasInitialized || presetsWithLanguage.length === 0) return;

    const nationalities = [
      'all',
      ...(Array.from(
        new Set(presetsWithLanguage.map((p) => p.nationality).filter(Boolean))
      ) as string[]),
    ];
    const genders = [
      'all',
      ...(Array.from(
        new Set(presetsWithLanguage.map((p) => p.gender).filter(Boolean))
      ) as string[]),
    ];
    const languages = [
      'all',
      ...(Array.from(
        new Set(presetsWithLanguage.map((p) => p.language).filter(Boolean))
      ) as string[]),
    ];
    setUniquePresetNationalities(nationalities.sort());
    setUniquePresetGenders(genders.sort((a, b) => a.localeCompare(b)));
    setUniquePresetLanguages(languages.sort());
  }, [presetsWithLanguage, hasInitialized]);

  // Apply filters only after initialization
  React.useEffect(() => {
    if (!hasInitialized) return;

    let filtered = [...presetsWithLanguage];

    if (presetAgeFilter !== 'all' && presetAgeFilter) {
      const [minAgeStr, maxAgeStr] = presetAgeFilter.split('-');
      const minAge = parseInt(minAgeStr, 10);
      const maxAge = maxAgeStr ? parseInt(maxAgeStr, 10) : Infinity;
      filtered = filtered.filter((p) => p.age && p.age >= minAge && p.age <= maxAge);
    }
    if (presetNationalityFilter !== 'all' && presetNationalityFilter) {
      filtered = filtered.filter((p) => p.nationality === presetNationalityFilter);
    }
    if (presetGenderFilter !== 'all' && presetGenderFilter) {
      filtered = filtered.filter(
        (p) => p.gender?.toLowerCase() === presetGenderFilter.toLowerCase()
      );
    }
    if (presetLanguageFilter !== 'all' && presetLanguageFilter) {
      filtered = filtered.filter((p) => p.language === presetLanguageFilter);
    }

    setCurrentFilteredPresets(filtered);
    setPresetsToShowCount(PRESETS_PAGE_LIMIT); // Reset count when filters change
  }, [
    presetsWithLanguage,
    presetAgeFilter,
    presetNationalityFilter,
    presetGenderFilter,
    presetLanguageFilter,
    hasInitialized,
  ]);

  // Update displayed presets
  React.useEffect(() => {
    if (!hasInitialized) return;
    setDisplayedPresets(currentFilteredPresets.slice(0, presetsToShowCount));
  }, [currentFilteredPresets, presetsToShowCount, hasInitialized]);

  const loadMorePresets = React.useCallback(() => {
    if (isLoadingMorePresets || presetsToShowCount >= currentFilteredPresets.length) return;

    setIsLoadingMorePresets(true);
    setTimeout(() => {
      // Simulate delay
      setPresetsToShowCount((prevCount) =>
        Math.min(prevCount + PRESETS_PAGE_LIMIT, currentFilteredPresets.length)
      );
      setIsLoadingMorePresets(false);
    }, 300);
  }, [isLoadingMorePresets, presetsToShowCount, currentFilteredPresets.length]);

  const canLoadMorePresets = displayedPresets.length < currentFilteredPresets.length;

  return {
    displayedPresets,
    loadMorePresets,
    canLoadMorePresets,
    isLoadingMorePresets,
    presetAgeFilter,
    setPresetAgeFilter,
    presetNationalityFilter,
    setPresetNationalityFilter,
    presetGenderFilter,
    setPresetGenderFilter,
    presetLanguageFilter,
    setPresetLanguageFilter,
    availableAgeBrackets: PRESET_AGE_BRACKETS,
    availableNationalities: uniquePresetNationalities,
    availableGenders: uniquePresetGenders,
    availableLanguages: uniquePresetLanguages,
    currentFilteredPresets,
    allAssistantPresets,
    /** Whether presets have been initialized */
    hasInitialized,
  };
}
