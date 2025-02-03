import React from "react";
import { Span } from "@/types/evals/traces";
import { LogComparisonProps } from "../types";
import UnifiedTraceView from "./TraceView";

const TraceView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
}) => {
  // Ensure the base “value” is an array of spans
  if (!Array.isArray(value)) {
    return (
      <p className="text-red-500">
        TraceView: Base value is not an array of spans.
      </p>
    );
  }

  // allTraces => one element if no comparables, or multiple if comparables exist
  const allTraces = [value, ...(comparables ?? [])] as Span[][];
  // rowIndexes => correspond to each trace’s row index
  const rowIndexes = [baseLogIndex, ...(comparisonLogsIndex ?? [])];

  return (
    <UnifiedTraceView
      allTraces={allTraces}
      rowIndexes={rowIndexes}
      diffMode={diffMode}
      splitView={splitView}
    />
  );
};

export default TraceView;