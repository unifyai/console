import React from "react";
import { Span } from "@/types/evals/traces";
import { LogComparisonProps } from "../types";
import SingleTraceView from "./SingleTraceView";
import MultiTraceView from "./MultiTraceView";

/**
 * TraceView checks if there's more than one trace (in comparables).
 * If no comparables => single view; else => multi-trace diff view.
 */
const TraceView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
}) => {
  if (!Array.isArray(value)) {
    return <p className="text-red-500">TraceView: Base value is not an array of spans.</p>;
  }

  // Single trace
  if (!comparables || comparables.length === 0) {
    return <SingleTraceView spans={value as Span[]} baseLogIndex={baseLogIndex} />
  }

  // Multi-trace
  const allTraces = [value, ...comparables] as Span[][];
  const rowIndexes = [baseLogIndex, ...comparisonLogsIndex];
  return <MultiTraceView allTraces={allTraces} rowIndexes={rowIndexes} />;
};

export default TraceView;