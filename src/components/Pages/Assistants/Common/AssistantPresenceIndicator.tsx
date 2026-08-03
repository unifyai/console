import type { AssistantStatus } from '@/types/assistants/assistant';
import { PresenceStatusDot } from './PresenceStatusDot';

interface AssistantPresenceIndicatorProps {
  status: AssistantStatus | null | undefined;
  /** Escalates the badge to a live-call glyph; implies `running`. */
  inCall?: boolean;
  className?: string;
  testId?: string;
}

export function AssistantPresenceIndicator({
  status,
  inCall = false,
  className,
  testId,
}: AssistantPresenceIndicatorProps) {
  return (
    <PresenceStatusDot
      online={status?.running === true}
      inCall={inCall}
      className={className}
      testId={testId}
    />
  );
}
