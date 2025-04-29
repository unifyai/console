import * as React from 'react';
import { ScrollArea } from "@/components/UI/scroll-area";
import type { HirePreset } from '@/types/assistants/hire';
import { PresetListItem } from './PresetListItem';
import { Button } from '@/components/UI/button';
import { X } from 'lucide-react';

interface PresetsPanelProps {
  // Removed isOpen, onOpenChange
  presets: HirePreset[];
  onPresetSelect: (preset: HirePreset) => void;
  onClose: () => void; // Added close handler
}

export function PresetsPanel({
  presets,
  onPresetSelect,
  onClose,
}: PresetsPanelProps) {

  // handleSelect logic remains the same, but doesn't call onOpenChange anymore
  const handleSelect = (preset: HirePreset) => {
    onPresetSelect(preset);
    // The parent now controls closing if needed after selection, or panel stays open
  }

  return (
    // Replace SheetContent with div
    <div className="h-full flex flex-col w-full bg-background">
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