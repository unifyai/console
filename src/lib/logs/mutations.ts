/**
 * Client mutations for LogGrid row create / update / delete via Console proxies.
 */

export async function updateLogEntries(args: {
  projectName: string;
  context: string;
  logIds: number[];
  entries: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  if (args.logIds.length === 0) return { ok: true };
  const res = await fetch('/api/logs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      logs: args.logIds,
      projectName: args.projectName,
      context: args.context,
      entries: args.entries,
      overwrite: true,
    }),
  });
  if (!res.ok) {
    console.error('Failed to update log entries', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}

export async function deleteLogRow(args: {
  projectName: string;
  context: string;
  logId: number;
}): Promise<{ ok: boolean }> {
  const res = await fetch('/api/logs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: args.projectName,
      context: args.context,
      idsAndFields: [[args.logId, null]],
    }),
  });
  if (!res.ok) {
    console.error('Failed to delete log row', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}

export async function createEmptyLogRow(args: {
  projectName: string;
  context: string;
  entries?: Record<string, unknown>;
}): Promise<{ ok: boolean; logId?: number }> {
  const res = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: args.projectName,
      context: args.context,
      entries: [args.entries ?? {}],
    }),
  });
  if (!res.ok) {
    console.error('Failed to create log row', await res.text().catch(() => res.status));
    return { ok: false };
  }
  const data: unknown = await res.json().catch(() => null);
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const rawIds = record?.logEventIds ?? record?.['log_event_ids'];
  const ids = Array.isArray(rawIds) ? (rawIds as number[]) : undefined;
  return { ok: true, logId: ids?.[0] };
}
