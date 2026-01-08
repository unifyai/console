import React from 'react';
import { Span } from '@/types/interfaces/traces';
import { LogComparisonProps } from '../types';
import UnifiedTraceView, { PersistedTraceViewState } from './TraceView';
import { LogsActions } from '@/types/interfaces/grid';
import { LogProps } from '@/types/interfaces/logs';

interface TraceViewProps extends LogComparisonProps {
  isImmutable?: boolean;
  persistedState?: PersistedTraceViewState;
  cellEditMode?: boolean;
  onSaveEdit?: (desc: { logIndex: number; path: (string | number)[]; newValue: any }) => void;
  onGroupSaveEdit?: (desc: {
    logIndices: number[];
    path: (string | number)[];
    newValue: any;
  }) => void;
  onTraceUpdate?: (logIndex: number, fieldName: string, newTrace: Span[]) => void;
  path?: (string | number)[];
  logsActions?: LogsActions;
  context: string | null;
  baseLog: LogProps | undefined;
  comparisonLogs: LogProps[] | undefined;
  fieldName: string;
}

const TraceView: React.FC<TraceViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = 'none',
  splitView = false,
  displayMode = 'markdown',
  persistedState,
  isImmutable,
  cellEditMode,
  onSaveEdit,
  onGroupSaveEdit,
  onTraceUpdate,
  path,
  logsActions,
  context,
  baseLog,
  comparisonLogs,
  fieldName,
}) => {
  // Ensure the base "value" is an array of spans
  if (!Array.isArray(value)) {
    return <p className="text-red-500">TraceView: Base value is not an array of spans.</p>;
  }

  // allTraces => one element if no comparables, or multiple if comparables exist
  const allTraces = [value, ...(comparables ?? [])] as Span[][];
  // rowIndexes => correspond to each trace's row index
  const rowIndexes = [baseLogIndex, ...(comparisonLogsIndex ?? [])];

  return (
    <UnifiedTraceView
      allTraces={allTraces}
      rowIndexes={rowIndexes}
      diffMode={diffMode}
      splitView={splitView}
      displayMode={displayMode}
      persistedState={persistedState}
      isImmutable={isImmutable}
      cellEditMode={cellEditMode}
      onSaveEdit={onSaveEdit}
      onGroupSaveEdit={onGroupSaveEdit}
      onTraceUpdate={onTraceUpdate}
      path={path}
      logsActions={logsActions}
      context={context || null}
      baseLog={baseLog}
      comparisonLogs={comparisonLogs}
      fieldName={fieldName}
    />
  );
};

export default TraceView;
