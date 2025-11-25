import type { LogsResponseProps, LogItemProps, LogFieldsResponseProps } from '@/types/interfaces/logs';

const baseParams: LogItemProps = {};

const baseGroups: LogItemProps = {};

export const mockLogFields: LogFieldsResponseProps = {
  'entries/message': {
    data_type: 'string',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: new Date().toISOString(),
    description: 'Log message',
  },
};

export const mockLogsResponse: LogsResponseProps = {
  params: baseParams,
  logs: [
    {
      type: 'ungrouped',
      id: 'log-1',
      ts: new Date().toISOString(),
      params: {},
      entries: { message: 'First log message' },
      derived_entries: {},
      clipped_fields: {},
    },
    {
      type: 'ungrouped',
      id: 'log-2',
      ts: new Date().toISOString(),
      params: {},
      entries: { message: 'Second log message' },
      derived_entries: {},
      clipped_fields: {},
    },
  ],
  count: 2,
  groups: baseGroups,
};

export function createMockLogs(count: number): LogsResponseProps {
  const logs = Array.from({ length: count }, (_, i) => ({
    type: 'ungrouped' as const,
    id: `log-${i + 1}`,
    ts: new Date().toISOString(),
    params: {},
    entries: { message: `Log ${i + 1}` },
    derived_entries: {},
    clipped_fields: {},
  }));

  return {
    params: baseParams,
    logs,
    count: logs.length,
    groups: baseGroups,
  };
}


