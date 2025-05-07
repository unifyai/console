import * as React from 'react';
import { ScrollArea } from "@/components/UI/scroll-area";
import { AssistantPreset } from '@/types/team/assistant';
import { PresetListItem } from './AssistantHirePresetsListItem';
import { Button } from '@/components/UI/button';
import { X } from 'lucide-react';

interface PresetsPanelProps {
  presets: AssistantPreset[];
  onPresetSelect: (preset: AssistantPreset) => void;
  onClose: () => void;
}

export function PresetsPanel({
  presets,
  onPresetSelect,
  onClose,
}: PresetsPanelProps) {

  const handleSelect = (preset: AssistantPreset) => {
    onPresetSelect(preset);
  }

  return (
    <div className="h-full flex flex-col w-full bg-background border-l">
      {/* Manual Header */}
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Available Hires</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close Presets</span>
        </Button>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {presets.length > 0 ? (
            presets.map((preset, index) => (
              <PresetListItem
                key={index}
                preset={preset}
                onSelect={handleSelect}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No presets available.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}