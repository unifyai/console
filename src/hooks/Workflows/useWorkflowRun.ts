'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { runWorkflowTask } from '@/lib/client/workflows';
import type { Assistant } from '@/types/assistants/assistant';
import type { WorkflowGalleryItem } from '@/types/workflows';

/**
 * Starting an installed workflow's work on demand.
 *
 * Separate from the install catalogue because it is a different act on a
 * different object: installing plants content through the assistant's
 * reconcile engine and is recorded as a request row, while running is a
 * trigger on the ordinary task that install planted. The workflow itself has
 * no runtime to start.
 *
 * Which task: the first one the installation planted. Every curated bundle
 * plants exactly one recurring job; a caller with a specific one in hand
 * passes its id.
 */
export function useWorkflowRun({
  assistant,
  items,
}: {
  assistant: Assistant | null;
  items: WorkflowGalleryItem[];
}): {
  /** Slugs whose job this session has asked the runtime to start. */
  running: Set<string>;
  runNow: (slug: string, taskId?: string) => Promise<void>;
} {
  const [running, setRunning] = React.useState<Set<string>>(new Set());

  const runNow = React.useCallback(
    async (slug: string, taskId?: string) => {
      const installation = items.find((item) => item.workflow.slug === slug)?.installation;
      const task = taskId
        ? installation?.tasks.find((candidate) => candidate.taskId === taskId)
        : installation?.tasks[0];
      if (!assistant || !task) return;

      setRunning((current) => new Set(current).add(slug));
      const { started, detail } = await runWorkflowTask(assistant, task.taskId);
      setRunning((current) => {
        const next = new Set(current);
        next.delete(slug);
        return next;
      });

      if (started) {
        toast.success(`${task.name} started.`, {
          description: 'It runs now instead of waiting for its next occurrence.',
        });
        return;
      }
      // The runtime's own reason — already running, already cancelled — rather
      // than a generic failure, because those need different responses.
      toast.error('Could not start that job.', { description: detail });
    },
    [assistant, items]
  );

  return { running, runNow };
}
