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

export function useAssistantPresets() {
  const [allAssistantPresets] = React.useState<AssistantPreset[]>(() =>
    shuffleArray(
      assistantPresetsConstant.filter(
        (assistant) => assistant.voiceIds[PRIMARY_VOICE_PROVIDER] || assistant.voiceIds['openai']
      ) as AssistantPreset[]
    )
  );

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

  const allPresetVoices = voicePresetsConstant as Voice[];

  const presetsWithLanguage = React.useMemo(() => {
    return allAssistantPresets.map((preset) => {
      const voiceId = preset.voiceIds[PRIMARY_VOICE_PROVIDER] || preset.voiceIds['openai'];
      const voice = allPresetVoices.find((v) => v.voiceId === voiceId);
      return {
        ...preset,
        language: voice?.language || null,
      };
    });
  }, [allAssistantPresets, allPresetVoices]);

  React.useEffect(() => {
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
  }, [presetsWithLanguage]);

  React.useEffect(() => {
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
  ]);

  React.useEffect(() => {
    setDisplayedPresets(currentFilteredPresets.slice(0, presetsToShowCount));
  }, [currentFilteredPresets, presetsToShowCount]);

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
  };
}
