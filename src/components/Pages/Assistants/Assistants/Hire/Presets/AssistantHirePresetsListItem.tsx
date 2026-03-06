import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { cn } from '@/lib/utils';
import { AssistantPreset } from '@/types/assistants/assistant';
import { Skeleton } from '@/components/UI/skeleton';
import { getLanguageLabel } from '@/utils/assistants/voice-utils';

type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface PresetListItemProps {
  preset: AssistantPreset;
  onSelect: (preset: AssistantPreset) => void;
  isSelected?: boolean;
}

export function PresetListItem({ preset, onSelect, isSelected }: PresetListItemProps) {
  const [loadingStatus, setLoadingStatus] = React.useState<ImageLoadingStatus>('loading');

  const displayName = `${preset.firstName} ${preset.surname}`;
  const fallback = `${preset.firstName?.[0] ?? ''}${preset.surname?.[0] ?? ''}`.toUpperCase();

  const handleLoadingStatusChange = (status: ImageLoadingStatus) => {
    setLoadingStatus(status);
  };

  return (
    <div
      className={cn(
        'flex cursor-pointer items-start gap-4 rounded-md border p-3',
        isSelected ? 'border-primary' : 'border-transparent hover:bg-muted'
      )}
      onClick={() => onSelect(preset)}
      role="button"
    >
      <Avatar className="relative h-10 w-10 flex-shrink-0 border">
        {' '}
        {/* Added relative for potential overlay */}
        {/* Show Skeleton while loading */}
        {loadingStatus === 'loading' && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-full" />
        )}
        <AvatarImage
          src={preset.profilePhoto ?? undefined}
          alt={displayName}
          onLoadingStatusChange={handleLoadingStatusChange}
          className={cn(loadingStatus !== 'loaded' && 'opacity-0')} // Hide image until loaded
        />
        <AvatarFallback
          className={cn(
            // Ensure fallback is visible only when needed (loading, error, or idle without src)
            loadingStatus === 'loading' || loadingStatus === 'error' || !preset.profilePhoto
              ? 'opacity-100'
              : 'opacity-0'
          )}
        >
          {fallback}
        </AvatarFallback>
      </Avatar>
      <div className="text-body min-w-0 space-y-1">
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-2">
          <span className="text-caption text-muted-foreground">Name:</span>
          <span className="text-strong truncate">{displayName}</span>
          <span className="text-caption text-muted-foreground">Age:</span>
          <span>{preset.age}</span>
          <span className="text-caption text-muted-foreground">Nationality:</span>
          <span>{preset.nationality}</span>
          <span className="text-caption text-muted-foreground">Language:</span>
          <span className="flex items-center gap-1.5">
            {preset.language ? getLanguageLabel(preset.language) : '-'}
          </span>
        </div>
        <p className="text-caption line-clamp-2 text-muted-foreground">
          {' '}
          {/* Show snippet */}
          {preset.about}
        </p>
      </div>
    </div>
  );
}
