import * as React from 'react';
import { AssistantPreset } from '@/types/team/assistant';
import assistantPresetsConstant from "@/constants/assistants/assistant_presets.js";

const PRESETS_PAGE_LIMIT = 12;
const PRESET_AGE_BRACKETS = ['all', '18-25', '26-35', '36-45', '46-55', '56+'];

const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export function useAssistantPresets() {
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

        if (presetAgeFilter !== 'all' && presetAgeFilter) {
            const [minAgeStr, maxAgeStr] = presetAgeFilter.split('-');
            const minAge = parseInt(minAgeStr, 10);
            const maxAge = maxAgeStr ? parseInt(maxAgeStr, 10) : Infinity;
            filtered = filtered.filter(p => p.age && p.age >= minAge && p.age <= maxAge);
        }
        if (presetRegionFilter !== 'all' && presetRegionFilter) {
            filtered = filtered.filter(p => p.region === presetRegionFilter);
        }
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
        setTimeout(() => { // Simulate delay
            setPresetsToShowCount(prevCount => Math.min(prevCount + PRESETS_PAGE_LIMIT, currentFilteredPresets.length));
            setIsLoadingMorePresets(false);
        }, 300);
    }, [isLoadingMorePresets, presetsToShowCount, currentFilteredPresets.length]);

    const canLoadMorePresets = displayedPresets.length < currentFilteredPresets.length;

    return {
        displayedPresets,
        loadMorePresets,
        canLoadMorePresets,
        isLoadingMorePresets,
        presetAgeFilter, setPresetAgeFilter,
        presetRegionFilter, setPresetRegionFilter,
        presetGenderFilter, setPresetGenderFilter,
        availableAgeBrackets: PRESET_AGE_BRACKETS,
        availableRegions: uniquePresetRegions,
        availableGenders: uniquePresetGenders,
        currentFilteredPresets, // Expose this if needed for "randomize"
    };
}