import type { ConsoleStepReport } from '@/lib/agent-guidance/consoleScriptOutcome';

/**
 * Hand a finished script's outcomes back to the runtime.
 *
 * Best effort by design: a report that fails to send leaves the assistant no
 * worse informed than it was before this existed, so a network blip must never
 * surface to the user or interrupt what the console is doing.
 */
export async function reportConsoleScriptResult(args: {
  assistantId: string;
  scriptId: string;
  reports: readonly ConsoleStepReport[];
}): Promise<void> {
  if (args.reports.length === 0) return;
  try {
    const response = await fetch(
      `/api/assistant/${encodeURIComponent(args.assistantId)}/console-script-result`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: args.scriptId, outcomes: args.reports }),
      }
    );
    if (!response.ok) {
      console.warn(`Console script result report failed (${response.status})`);
    }
  } catch (error) {
    console.warn('Console script result report failed', error);
  }
}
