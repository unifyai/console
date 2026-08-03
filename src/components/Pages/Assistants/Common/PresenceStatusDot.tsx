import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PresenceStatusDotProps {
  online: boolean;
  /** Escalates the badge to a live-call glyph; implies `online`. */
  inCall?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Presence badge at the bottom-right corner of an avatar (initials square or
 * droid body). Three states of increasing specificity: offline, online, and
 * on a call. The call badge is larger to fit a glyph but keeps the dot's
 * centre, so escalating between states does not shift the anchor point.
 */
export function PresenceStatusDot({
  online,
  inCall = false,
  className,
  testId,
}: PresenceStatusDotProps) {
  if (inCall) {
    return (
      <span
        role="status"
        aria-label="On a call"
        data-testid={testId}
        className={cn(
          'absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background',
          className
        )}
      >
        <Phone className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }

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
