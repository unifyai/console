import { cn } from '@/lib/utils';

interface PresenceStatusDotProps {
  online: boolean;
  className?: string;
  testId?: string;
}

/**
 * Online/offline badge at the bottom-right corner of an avatar (initials
 * square or droid body). Sized to match the rail activity notification dot
 * (`h-2 w-2`); static — no pulse.
 */
export function PresenceStatusDot({ online, className, testId }: PresenceStatusDotProps) {
  return (
    <span
      role="status"
      aria-label={online ? 'Online' : 'Offline'}
      data-testid={testId}
      className={cn(
        'absolute bottom-0.5 right-0.5 block h-2 w-2 rounded-full ring-2 ring-background',
        online ? 'bg-[var(--role-green)]' : 'bg-muted-foreground',
        className
      )}
    />
  );
}
