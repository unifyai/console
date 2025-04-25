import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { cn } from '@/lib/utils';
import type { HirePreset } from '@/types/assistants/hire';

interface PresetListItemProps {
  preset: HirePreset;
  onSelect: (preset: HirePreset) => void;
}

export function PresetListItem({ preset, onSelect }: PresetListItemProps) {
  const displayName = `${preset.firstName} ${preset.lastName}`;
  const fallback = `${preset.firstName?.[0] ?? ''}${preset.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div
      className="flex items-start gap-4 p-3 hover:bg-muted rounded-md cursor-pointer"
      onClick={() => onSelect(preset)}
      role="button"
    >
      <Avatar className="h-10 w-10 border flex-shrink-0">
        <AvatarImage src={preset.avatarUrl} alt={displayName} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <div className="space-y-1 text-sm min-w-0">
        <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline">
           <span className="text-muted-foreground text-xs">Name:</span>
           <span className="font-medium truncate">{displayName}</span>
           <span className="text-muted-foreground text-xs">Age:</span>
           <span>{preset.age}</span>
           <span className="text-muted-foreground text-xs">Region:</span>
           <span>{preset.region}</span>
        </div>
         <p className="text-xs text-muted-foreground line-clamp-2"> {/* Show snippet */}
            {preset.about}
        </p>
      </div>
    </div>
  );
}