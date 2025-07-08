import * as React from 'react';
import { ScrollArea } from "@/components/UI/scroll-area";
import { AssistantPreset } from '@/types/team/assistant';
import { PresetListItem } from './AssistantHirePresetsListItem';
import { Button } from '@/components/UI/button';
import { X, Filter, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { Label } from '@/components/UI/label';

const PRESET_ITEM_APPROX_HEIGHT = 90; // Approximate height of one PresetListItem + gap for threshold calculation

export interface PresetsPanelProps {
  displayedPresets: AssistantPreset[];
  onPresetSelect: (preset: AssistantPreset) => void;
  onClose: () => void;
  onLoadMore: () => void;
  canLoadMore: boolean;
  isLoadingMore: boolean;

  // Filters
  ageFilter: string;
  onAgeFilterChange: (value: string) => void;
  availableAgeBrackets: string[];

  regionFilter: string;
  onRegionFilterChange: (value: string) => void;
  availableRegions: string[];

  genderFilter: string;
  onGenderFilterChange: (value: string) => void;
  availableGenders: string[];
}

export function PresetsPanel({
  displayedPresets,
  onPresetSelect,
  onClose,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
  ageFilter,
  onAgeFilterChange,
  availableAgeBrackets,
  regionFilter,
  onRegionFilterChange,
  availableRegions,
  genderFilter,
  onGenderFilterChange,
  availableGenders,
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
          <h2 className="text-lg font-semibold">Available Hires</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close Presets</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="p-3 border-b space-y-3 flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <Select value={ageFilter} onValueChange={onAgeFilterChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Age" />
              </SelectTrigger>
              <SelectContent>
                {availableAgeBrackets.map(bracket => (
                  <SelectItem key={bracket} value={bracket} className="text-xs">
                    {bracket === 'all' ? 'All Ages' : bracket}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={regionFilter} onValueChange={onRegionFilterChange} disabled={availableRegions.length <= 1}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                {availableRegions.map(region => (
                  <SelectItem key={region} value={region} className="text-xs">
                    {region === 'all' ? 'All Regions' : region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={genderFilter} onValueChange={onGenderFilterChange} disabled={availableGenders.length <= 1}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                {availableGenders.map(gender => (
                  <SelectItem key={gender} value={gender} className="text-xs capitalize">
                    {gender === 'all' ? 'All Genders' : gender}
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
                key={`${preset.first_name}-${preset.surname}-${index}`} 
                preset={preset}
                onSelect={onPresetSelect}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No presets match filters.
            </p>
          )}
          {isLoadingMore && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
            </div>
          )}
          {!isLoadingMore && !canLoadMore && displayedPresets.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-4 pb-2">
              End of results.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}