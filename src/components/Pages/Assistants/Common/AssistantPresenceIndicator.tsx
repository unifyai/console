import type { AssistantStatus } from '@/types/assistants/assistant';
import { PresenceStatusDot } from './PresenceStatusDot';

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
  return (
    <PresenceStatusDot online={status?.running === true} className={className} testId={testId} />
  );
}
