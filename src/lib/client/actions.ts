import { buildExcludedManagerFilters } from '@/lib/assistants/event-filters';
import { combineFilters, escapeFilterValue } from '@/utils/assistants/filterExpressions';
import { buildTimestampFilter, compareLogsByTime } from '@/utils/assistants/assistant-actions';
import { snakeToCamelObject } from '@/utils/casing';
import type { ActionsLogsResponse } from '@/types/assistants/action';
import type { ResponseProps } from '@/types/common';

const MM_PAGE_SIZE = 100;
const TL_PAGE_SIZE = 500;
const MAX_TOTAL_LOGS = 5000;

type LogPayload = {
  logs?: Array<{ id: number; ts: string; entries?: Record<string, unknown> }>;
  count?: number;
  detail?: string;
};

async function fetchLogsPage(
  baseParams: URLSearchParams,
  limit: number,
  offset: number
): Promise<ActionsLogsResponse | ResponseProps> {
  const params = new URLSearchParams(baseParams);
  params.set('limit', String(limit));
  if (offset > 0) params.set('offset', String(offset));

  const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json')
    ? ((await response.json()) as LogPayload)
    : ({ detail: 'Received an invalid response from the server.' } satisfies ResponseProps);

  if (!response.ok) {
    return { detail: data.detail || `Failed to get events: ${response.statusText}` };
  }

  const logs = (data.logs ?? [])
    .map((log) => ({
      ...log,
      entries: snakeToCamelObject<Record<string, unknown>>(log.entries ?? {}),
    }))
    .sort(compareLogsByTime);

  return { logs, count: data.count ?? logs.length };
}

async function fetchAllLogs(
  baseParams: URLSearchParams,
  pageSize: number
): Promise<ActionsLogsResponse | ResponseProps> {
  const logs: ActionsLogsResponse['logs'] = [];
  let totalCount = 0;
  let offset = 0;

  while (true) {
    const page = await fetchLogsPage(baseParams, pageSize, offset);
    if ('detail' in page) return page;

    logs.push(...page.logs);
    if (offset === 0) totalCount = page.count;

    offset += pageSize;
    if (page.logs.length < pageSize || logs.length >= totalCount || logs.length >= MAX_TOTAL_LOGS) {
      break;
    }
  }

  return { logs: logs.sort(compareLogsByTime), count: totalCount || logs.length };
}

function managerMethodParams(
  ownerId: string,
  assistantId: string,
  startTime: string | null,
  extraFilters?: string[]
): URLSearchParams {
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context: `${ownerId}/${assistantId}/Events/ManagerMethod`,
  });
  const filters = [...buildExcludedManagerFilters()];
  if (startTime) filters.push(buildTimestampFilter(startTime));
  if (extraFilters) filters.push(...extraFilters);
  const filterExpr = combineFilters(filters);
  if (filterExpr) params.set('filterExpr', filterExpr);
  return params;
}

export async function fetchManagerMethodEvents(
  ownerId: string,
  assistantId: string,
  startTime: string | null,
  limit: number | null,
  offset?: number,
  extraFilters?: string[]
): Promise<ActionsLogsResponse | ResponseProps> {
  const params = managerMethodParams(ownerId, assistantId, startTime, extraFilters);
  if (limit === null && offset === undefined) {
    return fetchAllLogs(params, MM_PAGE_SIZE);
  }
  return fetchLogsPage(params, limit ?? MM_PAGE_SIZE, offset ?? 0);
}

export async function fetchToolLoopEvents(
  ownerId: string,
  assistantId: string,
  hierarchy: string[],
  limit: number | null,
  startTime?: string,
  endTime?: string
): Promise<ActionsLogsResponse | ResponseProps> {
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context: `${ownerId}/${assistantId}/Events/ToolLoop`,
  });
  const joinedHierarchy = hierarchy.join('->');
  const filters = [`hierarchy_label.startswith('${escapeFilterValue(joinedHierarchy)}')`];
  if (startTime) filters.push(`event_timestamp >= '${escapeFilterValue(startTime)}'`);
  if (endTime) filters.push(`event_timestamp <= '${escapeFilterValue(endTime)}'`);
  const filterExpr = combineFilters(filters);
  if (filterExpr) params.set('filterExpr', filterExpr);

  if (limit === null) {
    return fetchAllLogs(params, TL_PAGE_SIZE);
  }
  return fetchLogsPage(params, limit, 0);
}
