import * as React from 'react';
import { fetchHasRunningTaskRun } from '@/lib/client/tasks';
import type { Assistant } from '@/types/assistants/assistant';

const RUNNING_TASK_SNAPSHOT_INTERVAL_MS = 15_000;

export function useRunningTaskSnapshot({
  assistant,
  enabled,
}: {
  assistant: Assistant | null;
  enabled: boolean;
}) {
  const [hasRunningTaskRun, setHasRunningTaskRun] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!enabled || !assistant) {
      setHasRunningTaskRun(false);
      return;
    }

    const refresh = async () => {
      const hasRunning = await fetchHasRunningTaskRun(assistant);
      if (!cancelled) setHasRunningTaskRun(hasRunning);
    };

    void refresh();
    const interval = window.setInterval(refresh, RUNNING_TASK_SNAPSHOT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [assistant, enabled]);

  return { hasRunningTaskRun };
}
