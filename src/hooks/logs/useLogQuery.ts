'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildLogQuerySpec,
  fetchLogFields,
  fetchLogs,
  type LogFieldsResponseProps,
  type LogGridRow,
  type LogQuerySpec,
  type LogViewState,
} from '@/lib/logs';

export type UseLogQueryArgs = {
  projectName: string;
  context: string | null;
  view: LogViewState;
  /** When fields are already known, skip the fields round-trip on every page. */
  fields?: LogFieldsResponseProps;
  columnContext?: string | null;
  enabled?: boolean;
};

export type UseLogQueryResult = {
  rows: LogGridRow[];
  count: number;
  fields: LogFieldsResponseProps;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  spec: LogQuerySpec | null;
};

/**
 * Server-backed log page query keyed by project/context/filter/sort/page — not tileId.
 */
export function useLogQuery({
  projectName,
  context,
  view,
  fields: fieldsOverride,
  columnContext,
  enabled = true,
}: UseLogQueryArgs): UseLogQueryResult {
  const fieldsQuery = useQuery({
    queryKey: ['logFields', projectName, context],
    queryFn: ({ signal }) => fetchLogFields(projectName, context!, signal),
    enabled: enabled && !!context && !fieldsOverride,
    staleTime: 0,
  });

  const fields = React.useMemo(
    () => fieldsOverride ?? fieldsQuery.data ?? {},
    [fieldsOverride, fieldsQuery.data]
  );

  const spec = React.useMemo(() => {
    if (!context) return null;
    return buildLogQuerySpec({
      projectName,
      context,
      view,
      fields,
      columnContext,
    });
  }, [projectName, context, view, fields, columnContext]);

  const logsQuery = useQuery({
    queryKey: [
      'logQuery',
      projectName,
      context,
      spec?.filterExpr ?? '',
      spec?.sorting ?? '',
      spec?.limit ?? 0,
      spec?.offset ?? 0,
      columnContext ?? '',
    ],
    queryFn: ({ signal }) => fetchLogs(spec!, signal),
    enabled:
      enabled && !!spec && (!!fieldsOverride || fieldsQuery.isSuccess || fieldsQuery.isFetched),
    placeholderData: (prev) => prev,
  });

  return {
    rows: logsQuery.data?.rows ?? [],
    count: logsQuery.data?.count ?? 0,
    fields,
    isLoading: (!fieldsOverride && fieldsQuery.isLoading) || logsQuery.isLoading,
    isFetching: logsQuery.isFetching,
    error: (logsQuery.error ?? fieldsQuery.error) as Error | null,
    refetch: () => {
      void fieldsQuery.refetch();
      void logsQuery.refetch();
    },
    spec,
  };
}
