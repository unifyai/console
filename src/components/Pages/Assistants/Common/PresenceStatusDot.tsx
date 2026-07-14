import { cn } from '@/lib/utils';

interface PresenceStatusDotProps {
  online: boolean;
  className?: string;
  testId?: string;
}

/**
 * Online/offline badge that overhangs the bottom-right corner of an avatar
 * (initials square or droid body), matching the creature status treatment.
 */
export function PresenceStatusDot({ online, className, testId }: PresenceStatusDotProps) {
  return (
    <span
      role="status"
      aria-label={online ? 'Online' : 'Offline'}
      data-testid={testId}
      className={cn(
        'absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-background',
        online ? 'bg-[var(--role-green)]' : 'bg-muted-foreground',
        className
      )}
    />
  );
}
