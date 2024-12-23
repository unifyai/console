import React, { useState } from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";

/* 
  MatrixDisplay is presumably your custom component that nicely renders 
  a 2D array as a table or grid. 
*/
import { MatrixDisplay } from "@/utils/evals/selection";
import { Button } from "@/components/UI/button";

// Example icons from lucide-react
import { FileText, CaseLower, Pilcrow, Columns, AlignJustify } from "lucide-react";

/**
 * A helper that converts a 2D array matrix into a plain string,
 * suitable for line/word/character-based comparison in a DiffViewer.
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

const MatrixView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex
}) => {
  // Hooks must be declared unconditionally at the top:
  type DiffMode = "lines" | "words" | "characters";
  const modes: DiffMode[] = ["lines", "words", "characters"];
  const modeIcons = [<FileText key="lines" />, <CaseLower key="words" />, <Pilcrow key="chars" />];

  // Let the user cycle among diff modes & toggle split/inline.
  const [modeIndex, setModeIndex] = useState(0);
  const diffMode = modes[modeIndex];

  const [splitView, setSplitView] = useState(true);

  // Handlers:
  const handleCycleMode = () => setModeIndex((prev) => (prev + 1) % modes.length);
  const handleToggleSplit = () => setSplitView((prev) => !prev);

  // Now do your condition-based returns:
  // 1) If base is not a valid array:
  if (!Array.isArray(value)) {
    return <p className="text-red-500">MatrixView: not a valid matrix.</p>;
  }

  // 2) SINGLE MODE (no comparables):
  if (!comparables || comparables.length === 0) {
    return (
      <div className="space-y-2">
        <p className="font-bold">Matrix (Row {baseLogIndex})</p>
        <MatrixDisplay value={value} />
      </div>
    );
  }

  // 3) MULTI MODE
  const baseStr = matrixToString(value);

  return (
    <div className="space-y-4">
      {/* BASE matrix display */}
      <div>
        <h4 className="font-bold mb-2">Base Matrix (Row {baseLogIndex})</h4>
        <MatrixDisplay value={value} />
      </div>

      {/* Minimal toolbar for changing diff mode & split/inline */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCycleMode}
          title={`Cycle diff mode (current: ${diffMode})`}
        >
          {modeIcons[modeIndex]}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleSplit}
          title={splitView ? "Switch to Inline View" : "Switch to Split View"}
        >
          {splitView ? <Columns /> : <AlignJustify />}
        </Button>
      </div>

      {/* Diffs for each comparable */}
      <div className="flex flex-col space-y-4 border-l pl-4 mt-2">
        {comparables.map((comp, idx) => {
          const compIndex = comparisonLogsIndex[idx];
          const compStr = Array.isArray(comp)
            ? matrixToString(comp)
            : "Not a valid matrix";

          return (
            <div key={idx} className="diff-viewer-container">
              <h4 className="font-bold mb-2">
                Diff: Row {baseLogIndex} vs. Row {compIndex}
              </h4>
              <DiffViewer
                oldValue={baseStr}
                newValue={compStr}
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