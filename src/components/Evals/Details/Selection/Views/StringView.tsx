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
 * groupAllByValue => for diffMode==="none", lumps base + comparables into a single map
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
  // Available diff modes
  type DiffMode =  "none" | "lines" | "words" | "characters";
  const modes: DiffMode[] = ["none", "lines", "words", "characters"];
  const modeIcons = [
    <EyeOff key="none" />,
    <FileText key="lines" />,
    <CaseLower key="words" />,
    <Pilcrow key="characters" />,
  ];

  const [modeIndex, setModeIndex] = useState(0);
  const [splitView, setSplitView] = useState(false);
  const diffMode = modes[modeIndex];

  function handleCycleMode() {
    setModeIndex((prev) => (prev + 1) % modes.length);
  }
  function handleToggleSplit() {
    if (diffMode !== "none") {
      setSplitView((prev) => !prev);
    }
  }

  // Check single vs multi
  const singleMode = !comparables || comparables.length === 0;

  // If single => just display with a copy button at the top
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

  // Multi => we have baseStr + compStrs
  const baseStr = toStringSafe(value);
  const compStrs = comparables.map(toStringSafe);

  // If diffMode === "none," group ignoring base vs comp
  if (diffMode === "none") {
    const groups = groupAllByValue(value, comparables, baseLogIndex, comparisonLogsIndex);
    const disableSplit = true;

    return (
      <div className="space-y-4">
        {/* top controls */}
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
              tooltip="Disabled in 'none' mode"
              icon={splitView ? <Columns /> : <AlignJustify />}
              onClick={handleToggleSplit}
              variant="ghost"
              size="icon"
              disabled={disableSplit}
            />
          </div>
        </div>

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
  const { labelColor } = gatherPresenceDiffs(baseStr, compStrs, baseLogIndex, comparisonLogsIndex);
  const groups = groupComparablesByValue(compStrs, comparisonLogsIndex);

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="flex items-center justify-between">
        <div className={`font-semibold ${labelColor}`}>Difference</div>
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

      {groups.map((block, idx) => {
        const compStr = block.text;
        const rowNums = block.rows;

        const bothEmpty = (baseStr === "" && compStr === "");
        if (bothEmpty) {
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

        let baseBadgeMode = "delete";
        let compBadgeMode = "insert";
        if (baseStr === compStr && baseStr !== "") {
          baseBadgeMode = "none";
          compBadgeMode = "none";
        }

        return (
          <div key={idx} className="border rounded p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <RowBadge
                rowNumbers={[baseLogIndex]}
                mode={baseBadgeMode as "none" | "insert" | "delete"}
              />
              <RowBadge
                rowNumbers={rowNums}
                mode={compBadgeMode as "none" | "insert" | "delete"}
              />
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