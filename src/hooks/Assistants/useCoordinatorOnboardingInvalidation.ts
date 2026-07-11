import * as React from 'react';
import { subscribeToAssistantActionStream } from '@/lib/client/assistant-action-stream';

/**
 * Listen for server-side onboarding render changes on the assistant SSE
 * stream and invoke ``onInvalidate`` when Orchestra publishes a silent
 * ``onboarding_render_updated`` event.
 */
export function useCoordinatorOnboardingInvalidation(
  coordinatorAgentId: string | null | undefined,
  enabled: boolean,
  onInvalidate: () => void
): void {
  const onInvalidateRef = React.useRef(onInvalidate);
  onInvalidateRef.current = onInvalidate;

  React.useEffect(() => {
    if (!enabled || !coordinatorAgentId) {
      return;
    }

    return subscribeToAssistantActionStream(coordinatorAgentId, {
      onMessage: (data) => {
        try {
          const parsed = JSON.parse(data) as { type?: string };
          if (parsed.type === 'OnboardingStateUpdated') {
            onInvalidateRef.current();
          }
        } catch {
          /* ignore malformed frames */
        }
      },
    });
  }, [coordinatorAgentId, enabled]);
}
