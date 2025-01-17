"use client";
import React, { useState } from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import ActionButton from "@/components/Common/Buttons/Action";
import { MatrixDisplay } from "@/utils/evals/selection";
import { FileText, CaseLower, Pilcrow, Columns, AlignJustify } from "lucide-react";
import RowBadge from "./RowBadge";

/**
 * A helper that converts a 2D array matrix into a plain string
 * so we can do (line/word/char) diffs.
 */
function matrixToString(matrix: any[]): string {
  if (!Array.isArray(matrix)) {
    return "Not a valid matrix";
  }
  // Simple multiline approach:
  return matrix
    .map((row) => {
      if (Array.isArray(row)) {
        return row.join("  ");
      }
      return String(row);
    })
    .join("\n");
}

/**
 * groupMatricesByString:
 * For each comparable, convert it to a string with matrixToString.
 * Then group identical strings so they share one entry { str, rows, rawMatrix }.
 */
function groupMatricesByString(
  matrices: any[],
  rowIndexes: number[]
): { str: string; rows: number[]; rawMatrix: any }[] {
  const map = new Map<string, { rows: number[]; rawMatrix: any }>();

  matrices.forEach((mat, i) => {
    // Keep the original matrix so we can display it if desired
    const str = Array.isArray(mat) ? matrixToString(mat) : "Not a valid matrix";
    const existing = map.get(str);
    if (existing) {
      existing.rows.push(rowIndexes[i]);
    } else {
      map.set(str, {
        rows: [rowIndexes[i]],
        rawMatrix: mat,
      });
    }
  });

  return Array.from(map.entries()).map(([str, data]) => ({
    str,
    rows: data.rows,
    rawMatrix: data.rawMatrix,
  }));
}

const MatrixView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex
}) => {
  // Let the user cycle diff modes and toggle split view
  type DiffMode = "lines" | "words" | "characters";
  const modes: DiffMode[] = ["lines", "words", "characters"];
  const modeIcons = [
    <FileText key="lines" />,
    <CaseLower key="words" />,
    <Pilcrow key="chars" />,
  ];

  const [modeIndex, setModeIndex] = useState(0);
  const [splitView, setSplitView] = useState(false);
  const diffMode = modes[modeIndex];

  const handleCycleMode = () => setModeIndex((prev) => (prev + 1) % modes.length);
  const handleToggleSplit = () => setSplitView((prev) => !prev);

  // Validate the base matrix
  if (!Array.isArray(value)) {
    return <p className="text-red-500">MatrixView: not a valid matrix.</p>;
  }

  // SINGLE MODE
  if (!comparables || comparables.length === 0) {
    return (
      <div className="space-y-2">
        <p className="font-bold">Matrix (Row {baseLogIndex})</p>
        <MatrixDisplay value={value} />
      </div>
    );
  }

  // MULTI MODE
  const baseStr = matrixToString(value);

  // 1) Show the base matrix
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-bold mb-2">Base Matrix (Row {baseLogIndex})</h4>
        <MatrixDisplay value={value} />
      </div>

      {/* A small toolbar for changing diff mode & split/inline */}
      <div className="flex justify-end gap-2">
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

      {/* 2) Group comparables by identical matrix strings */}
      <div className="flex flex-col space-y-4 border-l pl-4 mt-2">
        {groupMatricesByString(comparables, comparisonLogsIndex ?? []).map((group, idx) => {
          // group.rows => array of row indexes for that identical matrix
          return (
            <div key={idx} className="diff-viewer-container space-y-2">
              {/* Instead of "Diff: Row X vs. Rows Y," do row badges */}
              <div className="flex items-center gap-1 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} isBase />
                <RowBadge rowNumbers={group.rows} />
              </div>

              {/* The text-based diff of base vs. comparable group */}
              <DiffViewer
                oldValue={baseStr}
                newValue={group.str}
                hideLineNumbers
                hideMarkers
                splitView={splitView}
                showDiffOnly={false}
                mode={diffMode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatrixView;