import React from "react";
import { Span } from "@/types/evals/traces";
import { LogComparisonProps } from "../types";
import UnifiedTraceView, { PersistedTraceViewState } from "./TraceView";

interface TraceViewProps extends LogComparisonProps {
  persistedState?: PersistedTraceViewState;
  cellEditMode?: boolean;
  onSaveEdit?: (
    desc: { source: "entries" | "params"; path: (string | number)[]; newValue: any }
  ) => void;
  path?: (string | number)[];
}

const TraceView: React.FC<TraceViewProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
  displayMode = "markdown",
  persistedState,
  cellEditMode,
  onSaveEdit,
  path,
}) => {
  // Ensure the base "value" is an array of spans
  if (!Array.isArray(value)) {
    return (
      <p className="text-red-500">
        TraceView: Base value is not an array of spans.
      </p>
    );
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
      cellEditMode={cellEditMode}
      onSaveEdit={onSaveEdit}
      path={path}
    />
  );
};

export default TraceView;