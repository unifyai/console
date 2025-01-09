import React, { useState } from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import { FileText, CaseLower, Pilcrow, Columns, AlignJustify } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import MarkdownRenderer from "@/components/UI/Chat/markdown-renderer";

/**
 * compressRowNumbers:
 * Accepts an array of row indexes like [1,2,3,5,6,7,10]
 * and returns a compressed string like "1-3,5-7,10".
 */
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur === end + 1) {
      end = cur;
    } else {
      if (start === end) {
        ranges.push(String(start));
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = cur;
      end = cur;
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
 * groupComparablesByValue:
 * Takes an array of comparable string values plus their row indexes,
 * then collects identical strings and merges their row indexes.
 * Returns an array of { text, rows }, where "rows" is the list of
 * row indexes that had the string "text".
 */
function groupComparablesByValue(comparables: string[], rowIndexes: number[]) {
  const map = new Map<string, number[]>();

  comparables.forEach((txt, i) => {
    const row = rowIndexes[i];
    const arr = map.get(txt) || [];
    arr.push(row);
    map.set(txt, arr);
  });

  // Convert each map entry -> { text, rows: number[] }
  return Array.from(map.entries()).map(([text, rows]) => ({ text, rows }));
}

const StringView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
}) => {
  // -------------------------------------------------------------------------
  // Diff mode logic and toggles
  // -------------------------------------------------------------------------
  type DiffMode = "lines" | "words" | "characters";
  const modes: DiffMode[] = ["lines", "words", "characters"];
  const modeIcons = [<FileText key="lines" />, <CaseLower key="words" />, <Pilcrow key="chars" />];

  const [modeIndex, setModeIndex] = useState(0);
  const [splitView, setSplitView] = useState(false);
  const diffMode = modes[modeIndex];

  const handleCycleMode = () => setModeIndex((prev) => (prev + 1) % modes.length);
  const handleToggleSplit = () => setSplitView((prev) => !prev);

  // -------------------------------------------------------------------------
  // If there's no comparables, just render the single string as Markdown
  // -------------------------------------------------------------------------
  const baseStr = (value ?? "").toString();
  if (!comparables || comparables.length === 0) {
    return (
      <div className="ml-2">
        <MarkdownRenderer>{baseStr}</MarkdownRenderer>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // When we have comparables, do grouped diffs
  // -------------------------------------------------------------------------
  // 1) Convert each comparable to a string
  const compStrings = comparables.map((c) => (c ?? "").toString());
  // 2) Group them by identical text
  const groups = groupComparablesByValue(compStrings, comparisonLogsIndex ?? []);

  return (
    <div className="flex flex-col space-y-4">
      {/* Diff toolbar */}
      <div className="flex justify-end gap-2 mb-2">
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

      {/* Render one DiffViewer per group of comparables with identical text */}
      {groups.map((group, idx) => {
        const rowSet = compressRowNumbers(group.rows);
        return (
          <div key={idx} className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Diff: Row {baseLogIndex} vs. Row(s) {rowSet}
            </p>
            <DiffViewer
              oldValue={baseStr}
              newValue={group.text}
              hideLineNumbers={false}
              hideMarkers
              splitView={splitView}
              showDiffOnly={true}
              mode={diffMode}
            />
          </div>
        );
      })}
    </div>
  );
};

export default StringView;