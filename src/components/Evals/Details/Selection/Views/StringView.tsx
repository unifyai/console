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
  EyeOff
} from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import MarkdownRenderer from "./MarkdownRenderer";
import RowBadge from "./RowBadge";


/**
 * Safely convert a value to a string. If the value is null or undefined, returns
 * an empty string. If it is already a string, returns it as is. Otherwise, calls
 * the String() constructor to convert the value.
 *
 * @param val The value to convert to a string.
 * @returns The value as a string.
 */
function toStringSafe(val: unknown): string {
  if (typeof val === "string") return val;
  if (val == null) return "";
  return String(val);
}

/** Compress an integer array like [2,3,4,6] => "2-4,6". */
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
    } else {
      if (start === end) {
        ranges.push(`${start}`);
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = current;
      end = current;
    }
  }
  if (start === end) {
    ranges.push(String(start));
  } else {
    ranges.push(`${start}-${end}`);
  }
  return ranges.join(",");
}

/**
 * gatherPresenceDiffs:
 *  - Checks if the base string is empty vs. comparables, to highlight rows
 *    that are “missing” or “added” data.
 *  - Returns: { labelColor, redRows, greenRows }.
 */
function gatherPresenceDiffs(
  baseStr: string,
  compStrs: string[],
  baseIdx: number,
  compIdxs: number[]
) {
  const baseHasContent = baseStr !== "";
  const redSet = new Set<number>();
  const greenSet = new Set<number>();

  compStrs.forEach((val, i) => {
    if (baseHasContent && val === "") {
      redSet.add(compIdxs[i]);
    } else if (!baseHasContent && val !== "") {
      greenSet.add(compIdxs[i]);
    }
  });

  let labelColor = "";
  if (baseHasContent && redSet.size > 0) {
    // base has data but some comps are missing => red
    labelColor = "text-red-600";
  } else if (!baseHasContent && greenSet.size > 0) {
    // base is empty, but comps have data => green
    labelColor = "text-green-600";
  }

  return {
    labelColor,
    redRows: [...Array.from(redSet)].sort((a, b) => a - b),
    greenRows: [...Array.from(greenSet),].sort((a, b) => a - b),
  };
}

/**
 * groupComparablesByValue:
 *  - For the old diff approach: takes compStrs + compIndices
 *    and lumps identical strings so each distinct text has => { text, rows }.
 */
function groupComparablesByValue(values: string[], rowIndices: number[]) {
  const map = new Map<string, number[]>();
  values.forEach((txt, i) => {
    const row = rowIndices[i];
    if (!map.has(txt)) {
      map.set(txt, []);
    }
    map.get(txt)!.push(row);
  });
  // Return an array => [ { text: "abc", rows: [2,4] }, ...]
  return Array.from(map.entries()).map(([text, rows]) => ({
    text,
    rows: rows.sort((a, b) => a - b),
  }));
}

/**
 * groupAllByValue:
 *  - For "none" mode: lumps the base string + all comparables into a single map,
 *    ignoring the idea of base vs. comparison. So each distinct text => { text, rows }.
 */
function groupAllByValue(
  baseValue: unknown,
  comparables: unknown[] | undefined,
  baseRowIndex: number,
  comparisonRows: number[]
) {
  const allStrings = [baseValue, ...(comparables ?? [])].map(toStringSafe);
  const allIndices = [baseRowIndex, ...comparisonRows];

  const map = new Map<string, number[]>();
  allStrings.forEach((txt, i) => {
    const row = allIndices[i];
    if (!map.has(txt)) {
      map.set(txt, []);
    }
    map.get(txt)!.push(row);
  });
  return Array.from(map.entries()).map(([text, rows]) => ({
    text,
    rows: rows.sort((a, b) => a - b),
  }));
}



export default function StringView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
}: LogComparisonProps) {
  // a) Setup diff modes
  type DiffMode =  "none" | "lines" | "words" | "characters";
  const modes: DiffMode[] = ["none", "lines", "words", "characters"];
  const modeIcons = [
    <EyeOff key="none" />,
    <FileText key="lines" />,
    <CaseLower key="words" />,
    <Pilcrow key="characters" />,
  ];

  // b) Local state
  const [modeIndex, setModeIndex] = useState(0);
  const [splitView, setSplitView] = useState(false);

  const diffMode = modes[modeIndex];

  function handleCycleMode() {
    setModeIndex((p) => (p + 1) % modes.length);
  }

  function handleToggleSplit() {
    // only toggle if not in "none" mode
    if (diffMode !== "none") {
      setSplitView((prev) => !prev);
    }
  }

  // c) Single vs multi
  const singleMode = !comparables || comparables.length === 0;

  //--------------------------------------------------------------------------------
  // SINGLE MODE: just display the single string as Markdown
  //--------------------------------------------------------------------------------
  if (singleMode) {
    const str = toStringSafe(value);
    if (!str) {
      return <p className="italic text-sm text-muted-foreground">No string</p>;
    }
    return <MarkdownRenderer>{str}</MarkdownRenderer>;
  }

  //--------------------------------------------------------------------------------
  // MULTI MODE: We have a base string + comparables
  //--------------------------------------------------------------------------------
  // 1) Common data
  const baseStr = toStringSafe(value);
  const compStrs = comparables.map(toStringSafe);

  // d) If "none" => skip base vs. comparables, just group them all
  if (diffMode === "none") {
    const groups = groupAllByValue(value, comparables, baseLogIndex, comparisonLogsIndex);
    const disableSplit = true;

    return (
      <div className="space-y-4">
        {/* Controls row */}
        <div className="flex items-center justify-between">
          <p className="font-semibold">Difference</p>
          <div className="flex items-center gap-2">
            <ActionButton
              tooltip={`Cycle diff mode (current: ${diffMode})`}
              icon={modeIcons[modeIndex]}
              onClick={handleCycleMode}
              variant="ghost"
              size="icon"
            />
            <ActionButton
              tooltip={"Disabled in 'none' mode"}
              icon={splitView ? <Columns /> : <AlignJustify />}
              onClick={handleToggleSplit}
              variant="ghost"
              size="icon"
              disabled={disableSplit}
            />
          </div>
        </div>

        {/* Show each unique text + row grouping */}
        {groups.map((block, idx) => {
          const rowLabel = compressRowNumbers(block.rows);
          return (
            <div key={idx} className="border rounded p-3 space-y-2">
              <span className="text-xs font-semibold py-[1px] rounded bg-background text-muted-foreground">
                [{rowLabel}]
              </span>
              {block.text ? (
                <MarkdownRenderer>{block.text}</MarkdownRenderer>
              ) : (
                <p className="text-sm italic text-muted-foreground">No data</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }


  const { labelColor, redRows, greenRows } = gatherPresenceDiffs(
    baseStr,
    compStrs,
    baseLogIndex,
    comparisonLogsIndex
  );
  const groups = groupComparablesByValue(compStrs, comparisonLogsIndex);

  return (
    <div className="space-y-4">
      {/* Controls row => with presence color, row badges, diff toggles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${labelColor}`}>Difference</span>
          {redRows.length > 0 && (
            <RowBadge rowNumbers={redRows} mode="delete" />
          )}
          {greenRows.length > 0 && (
            <RowBadge rowNumbers={greenRows} mode="insert" />
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
            tooltip={
              splitView
                ? "Switch to Inline View"
                : "Switch to Split View"
            }
            icon={splitView ? <Columns /> : <AlignJustify />}
            onClick={handleToggleSplit}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>

      {/* Show each distinct text block for the comparables */}
      {groups.map((block, idx) => {
        const compStr = block.text;
        const rowNums = block.rows;

        // both base & comp empty => "No data"
        if (baseStr === "" && compStr === "") {
          return (
            <div key={idx} className="border rounded p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} isBase mode="base" />
                <RowBadge rowNumbers={rowNums} mode="none" />
              </div>
              <p className="text-sm italic text-muted-foreground">No data</p>
            </div>
          );
        }

        // If they differ => color-coded row badges
        let baseBadgeMode = "delete";
        let compBadgeMode = "insert";
        if (baseStr === compStr && baseStr !== "") {
          // identical & non-empty => no highlight
          baseBadgeMode = "none";
          compBadgeMode = "none";
        }

        return (
          <div key={idx} className="border rounded p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode as "insert" | "delete" | "none"} />
              <RowBadge rowNumbers={rowNums} mode={compBadgeMode as "insert" | "delete" | "none" | "base"} />
            </div>
            {/* Use DiffViewer to compare baseStr vs. the block.text */}
            <DiffViewer
              oldValue={baseStr}
              newValue={compStr}
              splitView={splitView}
              hideLineNumbers={false}
              hideMarkers
              mode={diffMode} // "lines", "words", or "characters"
            />
          </div>
        );
      })}
    </div>
  );
}