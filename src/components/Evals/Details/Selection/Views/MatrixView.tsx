"use client";
import React, { useState } from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import ActionButton from "@/components/Common/Buttons/Action";
import { MatrixDisplay } from "@/utils/evals/selection";
import { FileText, CaseLower, Pilcrow, Columns, AlignJustify, EyeOff } from "lucide-react";
import RowBadge from "./RowBadge";


/**
 * matrixToString:
 * Converts a 2D array-like "matrix" into a single multiline string,
 * so you can do line/word/char diffs in DiffViewer.
 */
function matrixToString(matrix: any[]): string {
  if (!Array.isArray(matrix)) return "(invalid matrix)";
  return matrix
    .map((row) =>
      Array.isArray(row)
        ? row.join("  ")
        : String(row)
    )
    .join("\n");
}

/**
 * compressRowNumbers:
 * [2,3,4,7] => "2-4,7"
 */
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0], end = start;
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
  if (start === end) ranges.push(`${start}`);
  else ranges.push(`${start}-${end}`);
  return ranges.join(",");
}

/**
 * groupAllMatricesByValue:
 *  - For “none” mode: lumps base + comparables into a single map based on the
 *    matrix string. No concept of “base vs. comp,” just unique strings -> row sets.
 */
function groupAllMatricesByValue(
  baseValue: unknown,
  comparables: unknown[] | undefined,
  baseRowIndex: number,
  compRowIndices: number[]
) {
  const allMatrices = [baseValue, ...(comparables ?? [])];
  const allRows = [baseRowIndex, ...compRowIndices];

  // Convert each matrix to a string
  const map = new Map<string, { rawMatrix: any; rows: number[] }>();
  allMatrices.forEach((mat, i) => {
    const str = Array.isArray(mat) ? matrixToString(mat) : "(invalid matrix)";
    if (!map.has(str)) {
      map.set(str, { rawMatrix: mat, rows: [] });
    }
    map.get(str)!.rows.push(allRows[i]);
  });

  // Return as an array => { str, rawMatrix, rows }
  return Array.from(map.entries()).map(([str, obj]) => ({
    str,
    rawMatrix: obj.rawMatrix,
    rows: obj.rows.sort((a, b) => a - b),
  }));
}

/**
 * groupComparableMatrices:
 *  - For the “lines/words/characters” modes: first convert each comparable to a string,
 *    then group them if they share the exact same matrix string.
 */
function groupComparableMatrices(
  comparables: any[],
  compRowIndices: number[]
) {
  const map = new Map<string, { rawMat: any; rows: number[] }>();
  comparables.forEach((mat, i) => {
    const str = Array.isArray(mat) ? matrixToString(mat) : "(invalid matrix)";
    if (!map.has(str)) {
      map.set(str, { rawMat: mat, rows: [] });
    }
    map.get(str)!.rows.push(compRowIndices[i]);
  });
  return Array.from(map.entries()).map(([str, obj]) => ({
    str,
    rawMatrix: obj.rawMat,
    rows: obj.rows.sort((a, b) => a - b),
  }));
}

/**
 * Check if the provided matrix is “valid.” For simplicity, we'll just
 * verify that it's an array.
 */
function isValidMatrix(val: any): boolean {
  return Array.isArray(val);
}

/*-----------------------------------------------------------------------------
  2) Component: MatrixView
-----------------------------------------------------------------------------*/

const MatrixView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex
}) => {
  // a) Add “none” to the diff modes
  type DiffMode = "lines" | "words" | "characters" | "none";
  const modes: DiffMode[] = ["lines", "words", "characters" , "none"];
  const modeIcons = [
    <FileText key="lines" />,
    <CaseLower key="words" />,
    <Pilcrow key="characters" />,
    <EyeOff key="none" />,

  ];

  const [modeIndex, setModeIndex] = useState(0);
  const [splitView, setSplitView] = useState(false);
  const diffMode = modes[modeIndex];

  function handleCycleMode() {
    setModeIndex((p) => (p + 1) % modes.length);
  }
  function handleToggleSplit() {
    if (diffMode !== "none") {
      setSplitView((prev) => !prev);
    }
  }

  // b) SINGLE MODE => no comparables => just show one matrix
  const multiMode = comparables && comparables.length > 0;
  if (!multiMode) {
    // single => just show base matrix or an error
    if (!isValidMatrix(value)) {
      return <p className="text-red-500">MatrixView: Not a valid matrix.</p>;
    }
    return (
      <div className="space-y-2">
        <p className="font-bold">Matrix (Row {baseLogIndex})</p>
        <MatrixDisplay value={value} />
      </div>
    );
  }

  // c) MULTI MODE => base + comps
  //    If user picks “none,” group all together ignoring base vs. comps.
  if (diffMode === "none") {
    const groups = groupAllMatricesByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="font-semibold">Matrix (No Diff Mode)</p>
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
              disabled={true}
            />
          </div>
        </div>

        {/* Show each unique matrix from base or comps, grouped by its string repr */}
        {groups.map((grp, idx) => {
          const rowLabel = compressRowNumbers(grp.rows);
          if (!isValidMatrix(grp.rawMatrix)) {
            return (
              <div key={idx} className="border rounded p-3 space-y-2">
                <p className="text-xs font-semibold">Rows [{rowLabel}]</p>
                <p className="text-destructive">(Invalid matrix)</p>
              </div>
            );
          }
          return (
            <div key={idx} className="border rounded p-3 space-y-2">
              <p className="text-xs font-semibold">Rows [{rowLabel}]</p>
              <MatrixDisplay value={grp.rawMatrix} />
            </div>
          );
        })}
      </div>
    );
  }

  // d) DIFF MODES => "lines", "words", or "characters"
  //    We'll do the base string => matrixToString(value)
  //    Then group comparables by distinct string, produce a diff for each group.
  if (!isValidMatrix(value)) {
    return <p className="text-red-500">MatrixView: Not a valid base matrix.</p>;
  }

  const baseStr = matrixToString(value);
  const grouped = groupComparableMatrices(comparables, comparisonLogsIndex);

  // Optionally, you can highlight row presence diffs exactly like StringView if desired
  // e.g. check if baseStr is empty vs. each comparable. But here's a simpler usage:
  // We'll just show the base matrix once, then show diffs with each unique comparable group.

  return (
    <div className="space-y-4">
      {/* Base matrix + diff controls */}
      <div className="flex items-center justify-between">
        <p className="font-semibold">Matrix Diff</p>
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

      {/* Show the base matrix first */}
      <div>
        <h4 className="font-bold mb-2">Base Matrix (Row {baseLogIndex})</h4>
        <MatrixDisplay value={value} />
      </div>

      {/* Then each group => DiffViewer comparing baseStr vs. that group's str */}
      <div className="space-y-4 border-l pl-4 mt-2">
        {grouped.map((grp, idx) => {
          // row badges
          const rowLabel = compressRowNumbers(grp.rows);

          // If identical => no differences, but let's still show the row badges
          // We'll optionally color them. For a direct presence diff approach,
          // you might do something more advanced like the string version.
          let BadgeMode = "delete";
          let CompBadeMode = "insert"
          if (grp.str === baseStr && baseStr !== "(invalid matrix)" && baseStr !== "") {
            BadgeMode = "base";
            CompBadeMode = "none"

          }

          return (
            <div key={idx} className="diff-viewer-container space-y-2">
              <div className="flex items-center gap-1 text-xs">
                {/* base row first */}
                <RowBadge rowNumbers={[baseLogIndex]} mode={BadgeMode as "none" | "base" | "delete" | "insert" | undefined} />
                {/* comparable group rows */}
                <RowBadge rowNumbers={grp.rows} mode="base" />
              </div>

              <DiffViewer
                oldValue={baseStr}
                newValue={grp.str}
                hideLineNumbers={false}
                hideMarkers
                splitView={splitView}
                mode={diffMode} // "lines" | "words" | "characters"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatrixView;