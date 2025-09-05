import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { cn } from '@/lib/utils';
import { AssistantPreset } from '@/types/assistants/assistant';
import { Skeleton } from "@/components/UI/skeleton";

type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

interface PresetListItemProps {
  preset: AssistantPreset;
  onSelect: (preset: AssistantPreset) => void;
}

export function PresetListItem({ preset, onSelect }: PresetListItemProps) {
  const [loadingStatus, setLoadingStatus] = React.useState<ImageLoadingStatus>("loading");

  const displayName = `${preset.first_name} ${preset.surname}`;
  const fallback = `${preset.first_name?.[0] ?? ''}${preset.surname?.[0] ?? ''}`.toUpperCase();

  const handleLoadingStatusChange = (status: ImageLoadingStatus) => {
    setLoadingStatus(status);
  };

  return (
    <div
      className="flex items-start gap-4 p-3 hover:bg-muted rounded-md cursor-pointer"
      onClick={() => onSelect(preset)}
      role="button"
    >
      <Avatar className="h-10 w-10 border flex-shrink-0 relative"> {/* Added relative for potential overlay */}
        {/* Show Skeleton while loading */}
        {loadingStatus === 'loading' && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-full" />
        )}
        <AvatarImage
          src={preset.profile_photo ?? undefined}
          alt={displayName}
          onLoadingStatusChange={handleLoadingStatusChange}
          className={cn(loadingStatus !== 'loaded' && 'opacity-0')} // Hide image until loaded
        />
        <AvatarFallback
          className={cn(
            // Ensure fallback is visible only when needed (loading, error, or idle without src)
             (loadingStatus === 'loading' || loadingStatus === 'error' || !preset.profile_photo) ? 'opacity-100' : 'opacity-0'
          )}
        >
          {fallback}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-1 text-body min-w-0">
        <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline">
           <span className="text-caption text-muted-foreground">Name:</span>
           <span className="text-strong truncate">{displayName}</span>
           <span className="text-caption text-muted-foreground">Age:</span>
           <span>{preset.age}</span>
           <span className="text-caption text-muted-foreground">Region:</span>
           <span>{preset.region}</span>
        </div>
         <p className="text-caption text-muted-foreground line-clamp-2"> {/* Show snippet */}
            {preset.about}
        </p>
      </div>
    </div>
  );
}