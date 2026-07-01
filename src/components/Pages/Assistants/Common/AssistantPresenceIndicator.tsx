import { cn } from '@/lib/utils';
import type { AssistantStatus } from '@/types/assistants/assistant';

interface AssistantPresenceIndicatorProps {
  status: AssistantStatus | null | undefined;
  className?: string;
  testId?: string;
}

export function AssistantPresenceIndicator({
  status,
  className,
  testId,
}: AssistantPresenceIndicatorProps) {
  if (status == null) return null;

  const isOnline = status.running === true;

  return (
    <span
      role="status"
      aria-label={isOnline ? 'Online' : 'Offline'}
      data-testid={testId}
      className={cn(
        'absolute bottom-1 right-1 block h-2 w-2 rounded-full ring-2 ring-background',
        isOnline ? 'bg-[var(--role-green)]' : 'bg-muted-foreground',
        className
      )}
    />
  );
}
