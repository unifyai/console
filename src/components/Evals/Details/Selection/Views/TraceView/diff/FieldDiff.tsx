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
 * Group any comparables that produce the same text value. 
 * Returns an array of objects: { text, rowIndices: number[] }.
 */
function groupComparablesByValue(
  comparables: Array<Span | undefined>,
  rowIndexes: number[],
  getValue: (s: Span | undefined) => string
) {
  // rowIndexes[0] is the base row. Actual comparables begin at index 1,
  // so comparables[i] corresponds to rowIndexes[i+1].
  const map = new Map<string, number[]>(); // text -> array of row IDs

  comparables.forEach((comp, i) => {
    const text = getValue(comp);
    const compRow = rowIndexes[i + 1];
    const arr = map.get(text) || [];
    arr.push(compRow);
    map.set(text, arr);
  });

  // Convert Map into an array for easier iteration
  return Array.from(map.entries()).map(([text, rowIndices]) => ({
    text,
    rowIndices,
  }));
}

/**
 * FieldDiff:
 * For a single field "getValue(span)", do a textual diff vs. baseVal for each
 * group of comparables that yield the same text. This way, if 5 comparables
 * all match the same text, you see just one <DiffViewer> labeled 
 * “Diff row Base with row(s) 2,3,7,8,10."
 */
const FieldDiff: React.FC<Props> = ({
  baseVal,
  comparables,
  rowIndexes,
  getValue,
  diffMode,
  splitView,
}) => {
  // If nothing to compare, just render the single base value or note no data
  const baseText = getValue(baseVal);
  const baseRow = rowIndexes[0];

  // If no comparables exist at all, just show the base text, if any
  if (!comparables || comparables.length === 0) {
    if (!baseVal) {
      return (
        <em className="ml-2 text-xs text-muted-foreground">
          No base or comparable data
        </em>
      );
    }
    return (
      <div className="mb-2">
        <pre className="ml-2 text-sm inline-block">{baseText}</pre>
      </div>
    );
  }

  // ────────── GROUP comparables by their text ──────────
  const groups = groupComparablesByValue(comparables, rowIndexes, getValue);

  // If absolutely nothing in baseVal or comparables, show a small note
  if (!baseVal && groups.every((g) => g.text === "")) {
    return (
      <em className="ml-2 text-xs text-muted-foreground">No data on any side</em>
    );
  }

  return (
    <div className="mb-2 space-y-4">
      {groups.map((group, idx) => {
        // group.text is the newValue to compare with baseVal
        // group.rowIndices is an array of row indexes that share this text
        return (
          <div key={idx} className="border-l pl-2 pt-2">
            <p className="text-xs text-muted-foreground mb-1">
              {/* e.g. “Diff row 1 with row(s) 2,3,5” */}
              Diff row {baseRow} with row(s){" "}
              {group.rowIndices.join(", ")}
            </p>

            <DiffViewer
              oldValue={baseText}
              newValue={group.text}
              hideLineNumbers
              hideMarkers
              showDiffOnly={false}
              mode={diffMode}
              splitView={splitView}
            />
          </div>
        );
      })}
    </div>
  );
};

export default FieldDiff;