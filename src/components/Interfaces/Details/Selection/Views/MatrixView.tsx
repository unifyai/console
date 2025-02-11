"use client";
import React from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import { MatrixDisplay } from "@/utils/evals/selection";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";

/**
 * Convert a matrix (array of arrays) into a single string for diffing or grouping.
 */
function matrixToString(matrix: any[]): string {
  if (!Array.isArray(matrix)) return "(invalid matrix)";
  return matrix
    .map((row) => (Array.isArray(row) ? row.join("  ") : String(row)))
    .join("\n");
}

function isValidMatrix(val: any): boolean {
  return Array.isArray(val);
}

/**
 * Gather row sets for the same text (just like string grouping).
 */
function groupComparableMatrices(
  comparables: any[],
  compRowIndices: number[]
) {
  const map = new Map<string, { rawMat: any; rows: number[] }>();
  comparables.forEach((mat, i) => {
    const str = isValidMatrix(mat) ? matrixToString(mat) : "(invalid matrix)";
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
 * For diffMode==="none," combine base + comps ignoring base vs comp => distinct strings => row sets.
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
  allMatrices.forEach((mat: any, i) => {
    const str = isValidMatrix(mat) ? matrixToString(mat) : "(invalid matrix)";
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
 * groupVersionsForRows => used to cluster row indices that share a param version string.
 */
function groupVersionsForRows(
  rows: number[],
  baseLogIndex: number,
  baseVer: string,
  compLogIndexes: number[],
  compVers: string[]
) {
  const map = new Map<string, number[]>();
  rows.forEach((r) => {
    const verStr =
      r === baseLogIndex
        ? baseVer
        : compVers[compLogIndexes.indexOf(r)] ?? "";
    if (!map.has(verStr)) {
      map.set(verStr, []);
    }
    map.get(verStr)!.push(r);
  });
  return Array.from(map.entries()).map(([text, rowArr]) => ({
    text,
    rows: rowArr.sort((a, b) => a - b),
  }));
}

export default function MatrixView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
  version = "",
  comparableVersions = [],
}: LogComparisonProps) {
  const multiMode = !!(comparables && comparables.length > 0);
  const baseStr = matrixToString(value);
  const baseVer = version.toString();
  const compVerStrs = comparableVersions.map((v) => v.toString());
  const versionEmpty = baseVer === "" && compVerStrs.every((s) => s === "");

  // SINGLE => no comparables
  if (!multiMode) {
    if (!isValidMatrix(value)) {
      return <p className="text-red-500">MatrixView: Not a valid matrix.</p>;
    }
    const matrixStr = matrixToString(value);

    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold">Version</p>
            {baseVer ? (
              <div className="border rounded p-2 relative group">
                <MarkdownRenderer>{baseVer}</MarkdownRenderer>
                <CopyButton
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  content={baseVer}
                  copyMessage="Copied version!"
                  tooltipContent="Copy version"
                />
              </div>
            ) : (
              <p className="italic text-sm text-muted-foreground">No version</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="font-semibold">Matrix</p>
          <div className="space-y-2 border rounded p-2 relative group">
            <MatrixDisplay value={value} />
            <CopyButton
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              content={matrixStr}
              copyMessage="Copied matrix!"
              tooltipContent="Copy matrix"
            />
          </div>
        </div>
      </div>
    );
  }

  // MULTI => we have base + comparables
  if (diffMode === "none") {
    const groups = groupAllMatricesByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    return (
      <div className="space-y-4">
        {groups.map((grp, idx) => {
          const mat = grp.rawMatrix;
          const matStr = grp.str;
          const rowNums = grp.rows;
          const verGroups = groupVersionsForRows(
            rowNums,
            baseLogIndex,
            baseVer,
            comparisonLogsIndex,
            compVerStrs
          );

          return (
            <div key={idx} className="border rounded p-3 space-y-4">
              {!versionEmpty && (
                <div className="space-y-2">
                  <p className="font-semibold">Param Version</p>
                  {verGroups.map((vg, j) => (
                    <div key={j} className="border rounded p-2 relative group mb-2">
                      <RowBadge rowNumbers={vg.rows} mode="none" />
                      <CopyButton
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        content={vg.text}
                        copyMessage="Copied version!"
                        tooltipContent="Copy version"
                      />
                      {vg.text ? (
                        <div className="pt-2">
                          <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="italic text-sm text-muted-foreground">
                          No version
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="font-semibold">Matrix</p>
                <div className="flex items-center gap-2 text-xs">
                  <RowBadge rowNumbers={rowNums} mode="none" />
                </div>
                <div className="border rounded p-2 relative group">
                  {isValidMatrix(mat) ? (
                    <MatrixDisplay value={mat} />
                  ) : (
                    <p className="text-destructive">(Invalid matrix)</p>
                  )}
                  <CopyButton
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    content={matStr}
                    copyMessage="Copied matrix!"
                    tooltipContent="Copy matrix"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // For lines/words/characters => we highlight differences with DiffViewer
  // Convert base + each comparable to a string, show diffs
  const grouped = groupComparableMatrices(
    comparables ?? [],
    comparisonLogsIndex
  );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-bold mb-2">Base Matrix (Row {baseLogIndex})</h4>
        {isValidMatrix(value) ? (
          <div className="relative group">
            <MatrixDisplay value={value} />
            <CopyButton
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              content={matrixToString(value)}
              copyMessage="Copied matrix!"
              tooltipContent="Copy matrix"
            />
          </div>
        ) : (
          <p>(Invalid)</p>
        )}
      </div>

      <div className="space-y-4 border-l pl-4 mt-2">
        {grouped.map((grp, idx) => {
          const compStr = grp.str;
          const compMat = grp.rawMatrix;
          // If identical => no highlight
          const highlight = compStr !== baseStr && baseStr !== "(invalid matrix)" && compStr !== "(invalid matrix)";

          // For param versions, we gather rows combined with the base
          const combinedRows = [baseLogIndex, ...grp.rows];
          const verGroups = groupVersionsForRows(
            combinedRows,
            baseLogIndex,
            baseVer,
            comparisonLogsIndex,
            compVerStrs
          );

          return (
            <div key={idx} className="space-y-4">
              {!versionEmpty && (
                <div className="space-y-2">
                  <p className="font-semibold">Param Version</p>
                  {verGroups.map((vg, j) => {
                    const changed = (vg.rows.length > 1 && highlight);
                    const oldMode: "none" | "delete" = changed ? "delete" : "none";
                    const newMode: "none" | "insert" = changed ? "insert" : "none";
                    const baseInRows = vg.rows.includes(baseLogIndex);
                    const compRows = vg.rows.filter((r) => r !== baseLogIndex);

                    return (
                      <div key={j} className="p-3 space-y-2 border rounded">
                        <div className="flex items-center gap-1 text-xs">
                          {baseInRows && <RowBadge rowNumbers={[baseLogIndex]} mode={oldMode} />}
                          {!!compRows.length && <RowBadge rowNumbers={compRows} mode={newMode} />}
                        </div>
                        {vg.text ? (
                          <div className="pt-2">
                            <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                          </div>
                        ) : (
                          <p className="italic text-sm text-muted-foreground">
                            No version
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="diff-viewer-container space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <RowBadge
                    rowNumbers={[baseLogIndex]}
                    mode={highlight ? "delete" : "none"}
                  />
                  <RowBadge
                    rowNumbers={grp.rows}
                    mode={highlight ? "insert" : "none"}
                  />
                </div>
                <DiffViewer
                  oldValue={baseStr}
                  newValue={compStr}
                  hideLineNumbers={false}
                  hideMarkers
                  splitView={splitView}
                  mode={diffMode}
                />
              </div>
              {isValidMatrix(value) && isValidMatrix(compMat) && (
                <div className="flex flex-col gap-4">
                  <p className="font-semibold text-xs">Side-by-side Details</p>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-xs italic mb-1">Base Matrix</p>
                      <MatrixDisplay value={value} />
                    </div>
                    <div>
                      <p className="text-xs italic mb-1">
                        Comparison Matrix (Rows {grp.rows.join(", ")})
                      </p>
                      <MatrixDisplay value={compMat} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}