/**
 * Client mutations for LogGrid row create / update / delete via Console proxies.
 */

const LOG_CREATE_CHUNK = 500;

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

/** Batch-create log rows (chunked). Returns false if any chunk fails. */
export async function createLogRows(args: {
  projectName: string;
  context: string;
  entries: Record<string, unknown>[];
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<{ ok: boolean; created: number }> {
  const { entries } = args;
  if (entries.length === 0) return { ok: true, created: 0 };
  let created = 0;
  for (let i = 0; i < entries.length; i += LOG_CREATE_CHUNK) {
    const chunk = entries.slice(i, i + LOG_CREATE_CHUNK);
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: args.projectName,
        context: args.context,
        entries: chunk,
      }),
    });
    if (!res.ok) {
      console.error('Failed to create log rows', await res.text().catch(() => res.status));
      return { ok: false, created };
    }
    created += chunk.length;
    args.onProgress?.(created, entries.length);
  }
  return { ok: true, created };
}

/** Create an untyped entry field via Orchestra create_fields. */
export async function createLogField(args: {
  projectName: string;
  context: string;
  fieldName: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch('/api/logs/fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: args.projectName,
      context: args.context,
      fields: { [args.fieldName]: null },
    }),
  });
  if (!res.ok) {
    console.error('Failed to create log field', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}

export async function renameLogField(args: {
  projectName: string;
  context: string;
  oldFieldName: string;
  newFieldName: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch('/api/logs/fields', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: args.projectName,
      context: args.context,
      oldFieldName: args.oldFieldName,
      newFieldName: args.newFieldName,
    }),
  });
  if (!res.ok) {
    console.error('Failed to rename log field', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}

/** Delete a column from all rows (idsAndFields with null log id). */
export async function deleteLogField(args: {
  projectName: string;
  context: string;
  fieldName: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch('/api/logs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: args.projectName,
      context: args.context,
      idsAndFields: [[null, args.fieldName]],
    }),
  });
  if (!res.ok) {
    console.error('Failed to delete log field', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}
