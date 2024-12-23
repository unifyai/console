import React from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { Span } from "@/types/evals/traces";

interface Props {
  baseVal: Span | undefined;
  comparables: Array<Span | undefined>;
  rowIndexes: number[];
  getValue: (s: Span | undefined) => string;
  diffMode: "lines" | "words" | "characters";
  splitView: boolean;
}

/**
 * For a given field, do textual diffs vs. each comparable.
 */
const FieldDiff: React.FC<Props> = ({
  baseVal,
  comparables,
  rowIndexes,
  getValue,
  diffMode,
  splitView,
}) => {
  // Base text
  const baseText = getValue(baseVal);
  const baseRow = rowIndexes[0];
  const baseID = baseVal?.id ?? "---";

  // No comparables => show just the base text
  if (!comparables || comparables.length === 0) {
    return (
      <div className="mb-2">
        <pre className="ml-2 text-sm inline-block">{baseText}</pre>
      </div>
    );
  }

  // Render a diff for each comparable
  return (
    <div className="mb-2">
      {!baseVal && comparables.every((c) => !c) ? (
        <em className="ml-2 text-xs text-muted-foreground">No data on any side</em>
      ) : (
        comparables.map((comp, i) => {
          const compRow = rowIndexes[i + 1];
          const newText = getValue(comp);
          const compID = comp?.id ?? "---";

          return (
            <div key={i} className="border-l pl-2 my-2">
              <p className="text-xs text-muted-foreground mb-1">
                Diff row {baseRow} with row {compRow}
              </p>
              <DiffViewer
                oldValue={baseText}
                newValue={newText}
                hideLineNumbers
                hideMarkers
                showDiffOnly={false}
                mode={diffMode}
                splitView={splitView}
              />
            </div>
          );
        })
      )}
    </div>
  );
};

export default FieldDiff;