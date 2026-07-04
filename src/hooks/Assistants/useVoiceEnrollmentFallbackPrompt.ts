import * as React from 'react';

/**
 * Listen for ``VoiceEnrollmentSuggested`` on the active call assistant's
 * action SSE stream and open the fallback recorder when the call ends without
 * an existing manual voice sample on the user account.
 */
export function useVoiceEnrollmentFallbackPrompt({
  assistantId,
  callLifecycleActive,
  hasVoiceSample,
}: {
  assistantId: string | null;
  callLifecycleActive: boolean;
  hasVoiceSample: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const pendingRef = React.useRef(false);
  const wasCallActiveRef = React.useRef(false);

  React.useEffect(() => {
    if (!assistantId || typeof EventSource === 'undefined') return;
    if (!callLifecycleActive && !pendingRef.current) return;

    const source = new EventSource(`/api/assistant/${assistantId}/actions/stream`);

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === 'VoiceEnrollmentSuggested') {
          pendingRef.current = true;
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => {
      source.close();
    };
  }, [assistantId, callLifecycleActive]);

  React.useEffect(() => {
    const wasActive = wasCallActiveRef.current;
    wasCallActiveRef.current = callLifecycleActive;

    if (wasActive && !callLifecycleActive && pendingRef.current && !hasVoiceSample) {
      setOpen(true);
    }

    if (!callLifecycleActive && hasVoiceSample) {
      pendingRef.current = false;
      setOpen(false);
    }
  }, [callLifecycleActive, hasVoiceSample]);

  const onOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      pendingRef.current = false;
    }
  }, []);

  const onEnrolled = React.useCallback(() => {
    pendingRef.current = false;
  }, []);

  return { open, onOpenChange, onEnrolled };
}
