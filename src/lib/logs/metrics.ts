/**
 * Column metrics via Console `/api/logs/{metric}` — tile-agnostic.
 * Mirrors Interfaces `getColumnMetrics` without requiring LogsActions.
 */

export async function fetchColumnMetrics(args: {
  projectName: string;
  context: string;
  columns: string[];
  metric?: string;
  filter?: string | null;
  columnContext?: string | null;
  signal?: AbortSignal;
}): Promise<Record<string, number | Record<string, unknown>>> {
  const metricName = args.metric || 'mean';
  const params = new URLSearchParams();
  params.set('projectName', args.projectName);
  params.set('context', args.context);
  params.set('key', JSON.stringify(args.columns));
  if (args.filter) params.set('filter', args.filter);
  if (args.columnContext) params.set('columnContext', args.columnContext);

  const res = await fetch(`/api/logs/${metricName}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: args.signal,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: `Metrics ${res.status}` }));
    console.error('Failed to fetch column metrics', errorData);
    return {};
  }
  return (await res.json()) as Record<string, number | Record<string, unknown>>;
}
