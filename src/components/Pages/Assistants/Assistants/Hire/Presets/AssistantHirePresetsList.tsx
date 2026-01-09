import * as React from 'react';
import { ScrollArea } from "@/components/UI/scroll-area";
import { AssistantPreset } from '@/types/assistants/assistant';
import { PresetListItem } from './AssistantHirePresetsListItem';
import { Button } from '@/components/UI/button';
import { Loader2, MessageSquare, Minimize2, Maximize2, Minus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { getLanguageLabel } from '@/utils/assistants/voice-utils';

const PRESET_ITEM_APPROX_HEIGHT = 90; // Approximate height of one PresetListItem + gap for threshold calculation

export interface PresetsPanelProps {
  displayedPresets: AssistantPreset[];
  onPresetSelect: (preset: AssistantPreset) => void;
  onClose: () => void;
  layoutMode: 'split' | 'left' | 'right';
  setLayoutMode: React.Dispatch<React.SetStateAction<'split' | 'left' | 'right'>>;
  onLoadMore: () => void;
  canLoadMore: boolean;
  isLoadingMore: boolean;

  // Filters
  ageFilter: string;
  onAgeFilterChange: (value: string) => void;
  availableAgeBrackets: string[];

  nationalityFilter: string;
  onNationalityFilterChange: (value: string) => void;
  availableNationalities: string[];

  genderFilter: string;
  onGenderFilterChange: (value: string) => void;
  availableGenders: string[];

  languageFilter: string;
  onLanguageFilterChange: (value: string) => void;
  availableLanguages: string[];

  onToggleView?: () => void;
  isFastMode: boolean;
}

export function PresetsPanel({
  displayedPresets,
  onPresetSelect,
  onClose,
  layoutMode,
  setLayoutMode,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
  ageFilter,
  onAgeFilterChange,
  availableAgeBrackets,
  nationalityFilter,
  onNationalityFilterChange,
  availableNationalities,
  genderFilter,
  onGenderFilterChange,
  availableGenders,
  languageFilter,
  onLanguageFilterChange,
  availableLanguages,
  onToggleView,
  isFastMode,
}: PresetsPanelProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null); // Ref for the ScrollArea root

  React.useEffect(() => {
    const scrollAreaElement = scrollAreaRef.current;
    if (!scrollAreaElement) return;

    // Find the viewport element within the ScrollArea
    const viewportElement = scrollAreaElement.querySelector('div[data-radix-scroll-area-viewport]');

    if (!viewportElement) {
        console.warn("ScrollArea viewport not found for infinite scroll.")
        return;
    }

    const handleScroll = () => {
      if (isLoadingMore || !canLoadMore) return;
      // Load more when near the bottom (e.g., within 2 * item height)
      if (viewportElement.scrollTop + viewportElement.clientHeight >= viewportElement.scrollHeight - (PRESET_ITEM_APPROX_HEIGHT * 2)) {
        onLoadMore();
      }
    };

    viewportElement.addEventListener('scroll', handleScroll);
    return () => viewportElement.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, canLoadMore, isLoadingMore, displayedPresets]); // Add displayedPresets to re-attach if viewport remounts with new content structure

  return (
    <div className="h-full flex flex-col w-full bg-background border-l">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-title">Available Hires</h2>
        </div>
        <div className="flex items-center gap-1">
            {layoutMode === "split" &&
              <TooltipProvider delayDuration={100}>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button
                              type="button"
                              variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLayoutMode('left')}
                            >
                              <Minus className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top"><p>Minimize panel</p></TooltipContent>
                  </Tooltip>
              </TooltipProvider>
            }
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleView}>
                            <MessageSquare className="h-4 w-4" />
                            <span className="sr-only">Chat with Assistant</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Chat with Assistant</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLayoutMode(layoutMode === 'right' ? 'split' : 'right')} disabled={layoutMode === 'left'}>
                            {layoutMode === 'right' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                         </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>{layoutMode === 'right' ? 'Shrink panel' : 'Maximize panel'}</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b space-y-3 flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <Select value={ageFilter} onValueChange={onAgeFilterChange}>
              <SelectTrigger className="h-8 text-caption">
                <SelectValue placeholder="Age" />
              </SelectTrigger>
              <SelectContent>
                {availableAgeBrackets.map(bracket => (
                  <SelectItem key={bracket} value={bracket} className="text-caption">
                    {bracket === 'all' ? 'All Ages' : bracket}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={nationalityFilter} onValueChange={onNationalityFilterChange} disabled={availableNationalities.length <= 1}>
              <SelectTrigger className="h-8 text-caption">
                <SelectValue placeholder="Nationality" />
              </SelectTrigger>
              <SelectContent>
                {availableNationalities.map(nationality => (
                  <SelectItem key={nationality} value={nationality} className="text-caption">
                    {nationality === 'all' ? 'All Nationalities' : nationality}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={genderFilter} onValueChange={onGenderFilterChange} disabled={availableGenders.length <= 1}>
              <SelectTrigger className="h-8 text-caption">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                {availableGenders.map(gender => (
                  <SelectItem key={gender} value={gender} className="text-caption capitalize">
                    {gender === 'all' ? 'All Genders' : gender}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={languageFilter} onValueChange={onLanguageFilterChange} disabled={availableLanguages.length <= 1 || isFastMode}>
              <SelectTrigger className="h-8 text-caption">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map(lang => (
                  <SelectItem key={lang} value={lang} className="text-caption capitalize">
                    {lang === 'all' ? 'All Languages' : getLanguageLabel(lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-3">
          {displayedPresets.length > 0 ? (
            displayedPresets.map((preset, index) => (
              <PresetListItem
                key={`${preset.firstName}-${preset.surname}-${index}`} 
                preset={preset}
                onSelect={onPresetSelect}
                isFastMode={isFastMode}
              />
            ))
          ) : (
            <p className="text-body text-muted-foreground text-center py-8">
              No presets match filters.
            </p>
          )}
          {isLoadingMore && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-body text-muted-foreground">Loading...</span>
            </div>
          )}
          {!isLoadingMore && !canLoadMore && displayedPresets.length > 0 && (
            <p className="text-caption text-muted-foreground text-center pt-4 pb-2">
              End of results.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}