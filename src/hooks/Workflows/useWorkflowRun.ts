'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { runWorkflowTask } from '@/lib/client/workflows';
import { shouldUseMockWorkflows } from '@/utils/assistants/workflow-mock-data';
import type { Assistant } from '@/types/assistants/assistant';
import { unmetRequirements, type WorkflowGalleryItem } from '@/types/workflows';

/** How long the mock run pretends the trigger is in flight. */
const MOCK_RUN_MS = 700;

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
      const item = items.find((candidate) => candidate.workflow.slug === slug);
      const installation = item?.installation;
      const task = taskId
        ? installation?.tasks.find((candidate) => candidate.taskId === taskId)
        : installation?.tasks[0];
      const isMock = shouldUseMockWorkflows();
      if (!task || (!assistant && !isMock)) return;

      // A held job refuses to start on the runtime side too, but there the
      // answer is a generic failure after a round trip. The client already
      // knows both the state and the reason, so say the useful thing now.
      if (!task.enabled) {
        const missing = item ? unmetRequirements(item.workflow) : [];
        toast.error(`${task.name} is held.`, {
          description: missing.length
            ? `Connect ${missing.map((requirement) => requirement.displayName).join(' or ')} to arm it — it runs on its own schedule from then on.`
            : 'A required connection is missing; connect the app it needs to arm it.',
        });
        return;
      }

      setRunning((current) => new Set(current).add(slug));
      // Mock mode reviews the interaction with no backend at all: the pause is
      // there so the pending state is visible rather than a flicker.
      const { started, detail } = isMock
        ? await new Promise<{ started: boolean; detail?: string }>((resolve) =>
            setTimeout(() => resolve({ started: true }), MOCK_RUN_MS)
          )
        : await runWorkflowTask(assistant!, task.taskId);
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
