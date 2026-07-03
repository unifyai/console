import * as React from 'react';

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
    if (!enabled || !coordinatorAgentId || typeof EventSource === 'undefined') {
      return;
    }

    const source = new EventSource(`/api/assistant/${coordinatorAgentId}/actions/stream`);

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === 'OnboardingStateUpdated') {
          onInvalidateRef.current();
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => {
      source.close();
    };
  }, [coordinatorAgentId, enabled]);
}
