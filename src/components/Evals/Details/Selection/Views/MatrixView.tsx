"use client";
import React from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import ActionButton from "@/components/Common/Buttons/Action";
import { MatrixDisplay } from "@/utils/evals/selection";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";

/**
 * Convert a matrix (array of arrays) into a single string for diff.
 */
function matrixToString(matrix: any[]): string {
  if (!Array.isArray(matrix)) return "(invalid matrix)";
  return matrix
    .map((row) => (Array.isArray(row) ? row.join("  ") : String(row)))
    .join("\n");
}

/**
 * For diffMode === "none," lumps all matrices ignoring base vs comp => distinct strings => row sets.
 */
function groupAllMatricesByValue(
  baseValue: unknown,
  comparables: unknown[] | undefined,
  baseRowIndex: number,
  compRowIndices: number[]
) {
  const allMatrices = [baseValue, ...(comparables ?? [])];
  const allRows = [baseRowIndex, ...compRowIndices];

  const map = new Map<string, { rawMatrix: any; rows: number[] }>();
  allMatrices.forEach((mat, i) => {
    const str = Array.isArray(mat) ? matrixToString(mat) : "(invalid matrix)";
    if (!map.has(str)) {
      map.set(str, { rawMatrix: mat, rows: [] });
    }
    map.get(str)!.rows.push(allRows[i]);
  });

  return Array.from(map.entries()).map(([str, obj]) => ({
    str,
    rawMatrix: obj.rawMatrix,
    rows: obj.rows.sort((a, b) => a - b),
  }));
}

/**
 * For lines/words/characters => convert each comparable to a string and group them.
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

function isValidMatrix(val: any): boolean {
  return Array.isArray(val);
}

export default function MatrixView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
}: LogComparisonProps) {
  // Single => no comparables => just display the matrix
  const multiMode = comparables && comparables.length > 0;
  if (!multiMode) {
    if (!isValidMatrix(value)) {
      return <p className="text-red-500">MatrixView: Not a valid matrix.</p>;
    }
    const matrixStr = matrixToString(value);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <CopyButton
            content={matrixStr}
            copyMessage="Copied matrix!"
            tooltipContent="Copy matrix"
          />
        </div>
        <div className="border rounded p-2">
          <MatrixDisplay value={value} />
        </div>
      </div>
    );
  }

  // Multi-mode => we have base matrix + comparables
  if (!isValidMatrix(value)) {
    return <p className="text-red-500">MatrixView: Not a valid base matrix.</p>;
  }

  // If diffMode === "none," we group them ignoring base vs comp
  if (diffMode === "none") {
    const groups = groupAllMatricesByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    return (
      <div className="space-y-4">
        {groups.map((grp, idx) => {
          if (!isValidMatrix(grp.rawMatrix)) {
            return (
              <div key={idx} className="border rounded p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <RowBadge rowNumbers={grp.rows} mode="none" />
                </div>
                <p className="text-destructive">(Invalid matrix)</p>
              </div>
            );
          }

          const matrixStr = matrixToString(grp.rawMatrix);
          return (
            <div key={idx} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <RowBadge rowNumbers={grp.rows} mode="none" />
                <CopyButton
                  content={matrixStr}
                  copyMessage="Copied matrix!"
                  tooltipContent="Copy matrix"
                />
              </div>
              <MatrixDisplay value={grp.rawMatrix} />
            </div>
          );
        })}
      </div>
    );
  }

  // Otherwise => lines/words/characters
  const baseStr = matrixToString(value);
  const grouped = groupComparableMatrices(comparables, comparisonLogsIndex);

  return (
    <div className="space-y-4">
      {/* Show base matrix at top */}
      <div>
        <h4 className="font-bold mb-2">Base Matrix (Row {baseLogIndex})</h4>
        <MatrixDisplay value={value} />
      </div>

      {/* Compare with each group */}
      <div className="space-y-4 border-l pl-4 mt-2">
        {grouped.map((grp, idx) => {
          // If same as base => no highlight
          if (grp.str === baseStr && baseStr !== "(invalid matrix)" && baseStr !== "") {
            return (
              <div key={idx} className="diff-viewer-container space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <RowBadge rowNumbers={[baseLogIndex]} mode="none" />
                  <RowBadge rowNumbers={grp.rows} mode="none" />
                </div>
                <DiffViewer
                  oldValue={baseStr}
                  newValue={grp.str}
                  hideLineNumbers={false}
                  hideMarkers
                  splitView={splitView}
                  mode={diffMode}
                />
              </div>
            );
          }
          // Otherwise highlight
          return (
            <div key={idx} className="diff-viewer-container space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} mode="delete" />
                <RowBadge rowNumbers={grp.rows} mode="insert" />
              </div>
              <DiffViewer
                oldValue={baseStr}
                newValue={grp.str}
                hideLineNumbers={false}
                hideMarkers
                splitView={splitView}
                mode={diffMode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}