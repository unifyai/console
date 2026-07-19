'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchColumnMetrics } from '@/lib/logs/metrics';
import type { LogViewState } from '@/lib/logs/types';

export function useLogMetrics(args: {
  projectName: string;
  context: string;
  columns: string[];
  view: LogViewState;
  filter?: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      'logMetrics',
      args.projectName,
      args.context,
      args.view.metric ?? 'mean',
      args.columns.join(','),
      args.filter ?? '',
    ],
    queryFn: ({ signal }) =>
      fetchColumnMetrics({
        projectName: args.projectName,
        context: args.context,
        columns: args.columns,
        metric: args.view.metric ?? 'mean',
        filter: args.filter,
        signal,
      }),
    enabled: (args.enabled ?? true) && args.columns.length > 0,
    staleTime: 10_000,
  });
}
