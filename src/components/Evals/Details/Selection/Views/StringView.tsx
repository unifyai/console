"use client";

import React, { useState } from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import {
  FileText,
  CaseLower,
  Pilcrow,
  Columns,
  AlignJustify,
} from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import MarkdownRenderer from "./MarkdownRenderer";
import RowBadge from "./RowBadge";

function toStringSafe(val: unknown): string {
  if (typeof val === "string") return val;
  if (val == null) return "";
  return String(val);
}

/**
 * gatherPresenceDiffs:
 * Checks whether the base string is empty vs comparables.
 * Returns:
 *  - labelColor: display color class for the base label
 *  - redRows:    row indices missing data (if base has data)
 *  - greenRows:  row indices that have data (if base is empty)
 */
function gatherPresenceDiffs(
  baseStr: string,
  compStrs: string[],
  baseIdx: number,
  compIdxs: number[]
) {
  const baseHas = baseStr !== "";
  const redSet = new Set<number>();
  const greenSet = new Set<number>();

  compStrs.forEach((val, i) => {
    if (baseHas && val === "") {
      redSet.add(compIdxs[i]);
    } else if (!baseHas && val !== "") {
      greenSet.add(compIdxs[i]);
    }
  });

  let labelColor = "";
  if (baseHas && redSet.size > 0) {
    labelColor = "text-red-600";
  } else if (!baseHas && greenSet.size > 0) {
    labelColor = "text-green-600";
  }

  const redRows = Array.from(redSet).sort((a, b) => a - b);
  const greenRows = Array.from(greenSet).sort((a, b) => a - b);

  return { labelColor, redRows, greenRows };
}

/**
 * groupComparablesByValue:
 * If multiple comparables share an identical string,
 * combine them so they share one diff block → so you don't
 * render identical diffs for multiple rows that have the same text.
 */
function groupComparablesByValue(values: string[], rowIndexes: number[]) {
  const map = new Map<string, number[]>();
  values.forEach((txt, i) => {
    const row = rowIndexes[i];
    if (!map.has(txt)) {
      map.set(txt, []);
    }
    map.get(txt)!.push(row);
  });
  return Array.from(map.entries()).map(([text, rows]) => ({ text, rows }));
}

type DiffMode = "lines" | "words" | "characters";
const modes: DiffMode[] = ["lines", "words", "characters"];
const modeIcons = [
  <FileText key="lines" />,
  <CaseLower key="words" />,
  <Pilcrow key="chars" />,
];

/**
 * StringView:
 * 1) If no comparables, display a single string field (Markdown).
 * 2) If multiple comparables:
 *    - Compare presence vs. empty to highlight missing/added data.
 *    - Group identical comparables together so each distinct text is diffed once.
 *    - Provide controls (modeIndex, splitView) to switch diff mode or layout.
 */
export default function StringView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
}: LogComparisonProps) {
  // 1) Always call hooks at the top (no conditions):
  const [modeIndex, setModeIndex] = useState(0);
  const [splitView, setSplitView] = useState(false);

  // 2) Decide if single or multi mode
  const singleMode = !comparables || comparables.length === 0;

  // 3) Single mode → no diff needed
  if (singleMode) {
    const safeStr = toStringSafe(value);
    if (!safeStr) {
      return <p className="italic text-sm text-muted-foreground">No string</p>;
    }
    return <MarkdownRenderer>{safeStr}</MarkdownRenderer>;
  }

  // 4) Multi mode
  //    Convert base & comparables → strings
  const baseStr = toStringSafe(value);
  const compStrs = comparables.map(toStringSafe);

  const { labelColor, redRows, greenRows } = gatherPresenceDiffs(
    baseStr,
    compStrs,
    baseLogIndex,
    comparisonLogsIndex
  );

  // Group comparables that share identical text, so each distinct text is diffed once
  const groups = groupComparablesByValue(compStrs, comparisonLogsIndex);

  // The current diff mode and toggles
  const diffMode = modes[modeIndex];
  const handleCycleMode = () => setModeIndex((p) => (p + 1) % modes.length);
  const handleToggleSplit = () => setSplitView((p) => !p);

  return (
    <div className="space-y-4">
      {/* Header: presence-based row badges & diff controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${labelColor}`}>Difference</span>
          {redRows.length > 0 && (
            <RowBadge rowNumbers={redRows} customClass="bg-red-300 text-red-800" />
          )}
          {greenRows.length > 0 && (
            <RowBadge rowNumbers={greenRows} customClass="bg-green-300 text-green-800" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            tooltip={`Cycle diff mode (current: ${diffMode})`}
            icon={modeIcons[modeIndex]}
            onClick={handleCycleMode}
            variant="ghost"
            size="icon"
          />
          <ActionButton
            tooltip={splitView ? "Switch to Inline View" : "Switch to Split View"}
            icon={splitView ? <Columns /> : <AlignJustify />}
            onClick={handleToggleSplit}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>

      {/* Diff blocks for each unique comparable text */}
      {groups.map((block, idx) => {
        const { text: compStr, rows } = block;

        // If both base & comparable are empty, just show "No data"
        if (baseStr === "" && compStr === "") {
          return (
            <div key={idx} className="border rounded p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} isBase customClass="text-default bg-default" />
                <RowBadge rowNumbers={rows} customClass="text-default bg-default" />
              </div>
              <div className="flex items-center gap-2 border rounded p-3">
                <p className="text-sm text-muted-foreground italic">No data</p>
              </div>
            </div>
          );
        }

        // If they're identical (non-empty), no color on row badges
        let baseBadgeClass = "bg-red-200 text-red-800";
        let compBadgeClass = "bg-green-200 text-green-800";
        if (baseStr === compStr && baseStr !== "") {
          baseBadgeClass = "bg-default text-default";
          compBadgeClass = "bg-default text-default";
        }

        return (
          <div key={idx} className="border rounded p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <RowBadge rowNumbers={[baseLogIndex]} customClass={baseBadgeClass} />
              <RowBadge rowNumbers={rows} customClass={compBadgeClass} />
            </div>
            <DiffViewer
              oldValue={baseStr}
              newValue={compStr}
              splitView={splitView}
              hideLineNumbers={false}
              hideMarkers
              showDiffOnly
              mode={diffMode}
            />
          </div>
        );
      })}
    </div>
  );
}