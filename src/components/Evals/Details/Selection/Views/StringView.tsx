"use client";

import React from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import MarkdownRenderer from "./MarkdownRenderer";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";

/**
 * Convert unknown value => string.
 */
function toStringSafe(val: unknown): string {
  if (typeof val === "string") return val;
  if (val == null) return "";
  return String(val);
}

/**
 * gatherPresenceDiffs => highlight missing vs. added text
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
    labelColor = "text-red-600";
  } else if (!baseHasContent && greenSet.size > 0) {
    labelColor = "text-green-600";
  }

  return {
    labelColor,
    redRows: Array.from(redSet).sort((a, b) => a - b),
    greenRows: Array.from(greenSet).sort((a, b) => a - b),
  };
}

/**
 * groupComparablesByValue => for real diff ("lines"/"words"/"characters") to
 * group identical strings among comparables => { text, rows } blocks.
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
  return Array.from(map.entries()).map(([text, rows]) => ({
    text,
    rows: rows.sort((a, b) => a - b),
  }));
}

/**
 * groupAllByValue => for diffMode==="none", lumps base + comparables together
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
  diffMode = "none",
  splitView = false,
}: LogComparisonProps) {
  // If there's no comparables => single-mode
  const singleMode = !comparables || comparables.length === 0;

  // Single-mode => just render the string (no diff)
  if (singleMode) {
    const str = toStringSafe(value);
    if (!str) {
      return <p className="italic text-sm text-muted-foreground">No string</p>;
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <CopyButton
            content={str}
            copyMessage="Copied string!"
            tooltipContent="Copy string"
          />
        </div>
        <div className="border rounded p-2">
          <MarkdownRenderer>{str}</MarkdownRenderer>
        </div>
      </div>
    );
  }

  // Multi-mode => we have baseStr + compStrs
  const baseStr = toStringSafe(value);
  const compStrs = comparables.map(toStringSafe);

  // If diffMode === "none," group ignoring base vs comp
  if (diffMode === "none") {
    const groups = groupAllByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    return (
      <div className="space-y-4">
        {groups.map((block, idx) => {
          const textValue = block.text;
          return (
            <div key={idx} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <RowBadge rowNumbers={block.rows} mode="none" />
                <CopyButton
                  content={textValue}
                  copyMessage="Copied string!"
                  tooltipContent="Copy string"
                />
              </div>

              {textValue ? (
                <MarkdownRenderer>{textValue}</MarkdownRenderer>
              ) : (
                <p className="text-sm italic text-muted-foreground">No data</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Otherwise => lines/words/characters
  const { redRows, greenRows } = gatherPresenceDiffs(
    baseStr,
    compStrs,
    baseLogIndex,
    comparisonLogsIndex
  );
  const groups = groupComparablesByValue(compStrs, comparisonLogsIndex);

  return (
    <div className="space-y-4">
      {groups.map((block, idx) => {
        const compStr = block.text;
        const rowNums = block.rows;

        // both empty?
        if (baseStr === "" && compStr === "") {
          return (
            <div key={idx} className="border rounded p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} mode="none" />
                <RowBadge rowNumbers={rowNums} mode="none" />
              </div>
              <p className="text-sm italic text-muted-foreground">No data</p>
            </div>
          );
        }

        // same => "none" or different => "delete"/"insert"
        let baseBadgeMode: "none" | "insert" | "delete" = "none";
        let compBadgeMode: "none" | "insert" | "delete" = "none";
        if (baseStr !== compStr) {
          baseBadgeMode = "delete";
          compBadgeMode = "insert";
        }

        return (
          <div key={idx} className="border rounded p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />
              <RowBadge rowNumbers={rowNums} mode={compBadgeMode} />
            </div>
            <DiffViewer
              oldValue={baseStr}
              newValue={compStr}
              splitView={splitView}
              hideLineNumbers={false}
              hideMarkers
              mode={diffMode}
            />
          </div>
        );
      })}
    </div>
  );
}
