import type { LogsResponseProps, LogItemProps, LogFieldsResponseProps } from '@/types/interfaces/logs';

const baseParams: LogItemProps = {};

const baseGroups: LogItemProps = {};

// Total number of logs in the mock dataset (for pagination testing)
export const MOCK_LOGS_TOTAL_COUNT = 100;

export const mockLogFields: LogFieldsResponseProps = {
  'entries/message': {
    data_type: 'string',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'Log message',
  },
  'entries/status': {
    data_type: 'string',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'Status indicator',
  },
  'entries/user': {
    data_type: 'string',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'User identifier',
  },
  'entries/score': {
    data_type: 'float',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'Numeric score',
  },
  'entries/latency_ms': {
    data_type: 'int',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'Latency in milliseconds',
  },
  'entries/is_active': {
    data_type: 'bool',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'Active flag',
  },
  'entries/created_at': {
    data_type: 'timestamp',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'Creation timestamp',
  },
};

/**
 * Format timestamp to match Orchestra API format (no timezone Z suffix)
 */
function formatOrchestraTimestamp(date: Date): string {
  return date.toISOString().replace('Z', '').slice(0, -3);
}

/**
 * Static mock response matching real Orchestra API structure exactly.
 * Use createMockLogs() for dynamic/parameterized tests.
 */
export const mockLogsResponse: LogsResponseProps = {
  params: baseParams,
  logs: [
    {
      type: 'ungrouped',
      id: '1',
      ts: formatOrchestraTimestamp(new Date()),
      params: {},
      entries: { message: 'First log message' },
      derived_entries: {},
      versions: {},
      clipped_fields: [],
    },
    {
      type: 'ungrouped',
      id: '2',
      ts: formatOrchestraTimestamp(new Date()),
      params: {},
      entries: { message: 'Second log message' },
      derived_entries: {},
      versions: {},
      clipped_fields: [],
    },
  ],
  count: 2,
  groups: baseGroups,
};

export interface CreateMockLogsOptions {
  offset?: number;
  totalCount?: number;
}

/**
 * Creates mock log entries matching the real Orchestra API structure exactly.
 * Supports pagination via offset parameter.
 * 
 * Real API response structure:
 * {
 *   "params": {},
 *   "logs": [{
 *     "id": 15675373,           // number
 *     "ts": "2025-12-04T13:22:03.330797",  // no Z suffix
 *     "params": {},
 *     "entries": { ... },
 *     "derived_entries": {},
 *     "versions": {},
 *     "clipped_fields": []      // array, not object
 *   }],
 *   "count": 7483857
 * }
 */
export function createMockLogs(count: number, options: CreateMockLogsOptions = {}): LogsResponseProps {
  const { offset = 0, totalCount = MOCK_LOGS_TOTAL_COUNT } = options;
  
  const logs = Array.from({ length: count }, (_, i) => {
    const index = offset + i;
    const logId = 1000000 + index + 1; // Use realistic numeric IDs
    const timestamp = new Date(Date.now() - (totalCount - index) * 60000);
    
    return {
      type: 'ungrouped',
      id: String(logId),
      ts: formatOrchestraTimestamp(timestamp),
      params: {},
      entries: {
        message: `Log message ${index + 1}`,
        status: index % 3 === 0 ? 'error' : index % 3 === 1 ? 'warning' : 'success',
        user: `user_${(index % 5) + 1}`,
        score: Math.round((index + 1) * 10.5),
        latency_ms: 100 + (index * 10),
        is_active: index % 2 === 0,
        created_at: formatOrchestraTimestamp(timestamp),
      },
      derived_entries: {},
      versions: {},
      clipped_fields: [] as string[],
    };
  });

  return {
    params: baseParams,
    logs,
    count: totalCount,
    groups: baseGroups,
  };
}

import type { LogProps } from '@/types/interfaces/logs';

/**
 * Applies a simple filter to the mock logs based on a filter expression.
 * This is a simplified implementation for testing purposes.
 */
export function filterMockLogs(logs: LogProps[], filterExpression: string | null): LogProps[] {
  if (!filterExpression) return logs;
  
  // Simple substring match on message field
  const lowerFilter = filterExpression.toLowerCase();
  return logs.filter((log: LogProps) => {
    const message = log.entries?.message?.toString().toLowerCase() || '';
    const status = log.entries?.status?.toString().toLowerCase() || '';
    const user = log.entries?.user?.toString().toLowerCase() || '';
    return message.includes(lowerFilter) || status.includes(lowerFilter) || user.includes(lowerFilter);
  });
}

/**
 * Applies simple sorting to mock logs.
 */
export function sortMockLogs(logs: LogProps[], sortingExpression: string | null): LogProps[] {
  if (!sortingExpression) return logs;
  
  // Parse simple sorting like "entries/score:desc" or "entries/message:asc"
  const [field, direction] = sortingExpression.split(':');
  const fieldName = field.replace('entries/', '');
  const isDesc = direction === 'desc';
  
  return [...logs].sort((a: LogProps, b: LogProps) => {
    const aVal = a.entries?.[fieldName];
    const bVal = b.entries?.[fieldName];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return isDesc ? bVal - aVal : aVal - bVal;
    }
    
    const aStr = String(aVal || '');
    const bStr = String(bVal || '');
    return isDesc ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
  });
}


