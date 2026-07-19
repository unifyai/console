import { fetchBrainContext } from '@/lib/client/brain';
import type { Assistant } from '@/types/assistants/assistant';
import type { BrainContextData, TaskRunRow } from '@/types/assistants/brain';

export const RUNNING_TASK_RUN_FILTER_EXPR = 'state == "running"';

export async function fetchHasRunningTaskRun(assistant: Assistant): Promise<boolean> {
  const data = (await fetchBrainContext(assistant, 'Tasks/Runs', {
    limit: 50,
    offset: 0,
    filter: RUNNING_TASK_RUN_FILTER_EXPR,
    readAcrossRoots: false,
  })) as BrainContextData<TaskRunRow>;

  return data.count > 0 || data.rows.some((row) => row.state === 'running');
}
