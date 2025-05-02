"use client";

import React from "react";
import { toast } from "sonner";
import { useEditablePrimitive } from "@/hooks/useEditablePrimitive";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";
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
 * (used for "lines"/"words"/"characters" modes)
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
 * groupComparablesByValue => for diff="lines"/"words"/"characters" we group
 * identical strings among comparables => { text, rows } blocks.
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
 * groupAllByValue => for diffMode==="none", lumps base + comparables
 * together so identical strings appear once with combined row badges.
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

/**
 * groupVersionsForRows => given a set of rows that share the same main string,
 * group them by their version text so that identical versions appear once.
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

  // Return array of objects with the version text and the rows that share it
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
  version = "",
  comparableVersions = [""],
  displayMode = "markdown",
  cellEditMode = false,
  onSaveEdit,
  path = [],
}: LogComparisonProps) {
  // Prepare string values
  const singleMode = !comparables || comparables.length === 0;
  const { draft, inputProps } = useEditablePrimitive<string>(toStringSafe(value), (newVal) => {
    if (onSaveEdit) onSaveEdit({ source: "entries", path, newValue: newVal });
  });

  // If editable => simple input / textarea
  if (cellEditMode) {
    const isMultiLine = draft.length > 80;

    const commonProps = {
      className: "w-full border rounded p-1 text-sm font-mono",
      ...inputProps,
    } as const;

    return (
      <div>
        {isMultiLine ? (
          <textarea rows={4} {...commonProps} />
        ) : (
          <input
            type="text"
            {...commonProps}
          />
        )}
      </div>
    );
  }

  const baseStr = toStringSafe(value);
  const compStrs = (comparables ?? []).map(toStringSafe);

  // Prepare version strings
  const baseVerStr = toStringSafe(version);
  const compVerStrs = (comparableVersions ?? []).map(toStringSafe);

  // Check if *all* versions are empty
  const versionEmpty =
    baseVerStr === "" && compVerStrs.every((s) => s === "");

  // SINGLE MODE => No comparables
  if (singleMode) {
    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold">Version</p>
            {baseVerStr ? (
              <div className="flex border rounded p-2 relative group">
                <div className="mt-1 mb-1">
                  {displayMode === "markdown" ? (
                    <MarkdownRenderer>{baseVerStr}</MarkdownRenderer>
                  ) : (
                    <div className="whitespace-pre-wrap">{baseVerStr}</div>
                  )}
                </div>
                <CopyButton
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  content={baseVerStr}
                  copyMessage="Copied version!"
                  tooltipContent="Copy version"
                />
              </div>
            ) : (
              <p className="italic text-sm text-muted-foreground">No version</p>
            )}
          </div>
        )}

        {baseStr ? (
          <div className="space-y-2">
            {!versionEmpty && (
              <p className="font-semibold">Value</p>
            )}
            <div className="flex border rounded p-2 relative group max-w-full overflow-hidden">
              <div className="mt-1 mb-1 w-full overflow-x-auto">
                {displayMode === "markdown" ? (
                  <MarkdownRenderer>{baseStr}</MarkdownRenderer>
                ) : (
                  <div className="whitespace-pre-wrap">{baseStr}</div>
                )}
              </div>
              <CopyButton
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                content={baseStr}
                copyMessage="Copied string!"
                tooltipContent="Copy string"
              />
            </div>
          </div>
        ) : (
          <p className="italic text-sm text-muted-foreground">No string</p>
        )}
      </div>
    );
  }

  // MULTI-MODE => We have baseStr + compStrs

  // If diffMode === "none", group everything by main string
  if (diffMode === "none") {
    const stringGroups = groupAllByValue(
      baseStr,
      compStrs,
      baseLogIndex,
      comparisonLogsIndex
    );

    // Filter out groups where all values are empty strings
    const filteredGroups = stringGroups.filter(group => group.text.trim() !== "");

    return (
      <div className="space-y-4">
        {filteredGroups.map((block, i) => {
          // block.text => the main string value
          // block.rows => whichever rows share that string
          const textValue = block.text;
          const rowNums = block.rows;

          const versionGroups = groupVersionsForRows(
            rowNums,
            baseLogIndex,
            baseVerStr,
            comparisonLogsIndex,
            compVerStrs
          );

          return (
            <div key={i} className="p-3 space-y-4">
              {!versionEmpty && (
                <div className="space-y-2">
                  <p className="font-semibold">Version</p>
                  {versionGroups.map((vg, j) => {
                    const verText = vg.text;
                    return (
                      <div
                        key={j}
                        className="space-y-2 border rounded p-2 relative group max-w-full overflow-hidden"
                      >
                        <RowBadge rowNumbers={vg.rows} mode="none" />
                        <CopyButton
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          content={verText}
                          copyMessage="Copied version!"
                          tooltipContent="Copy version"
                        />
                        {verText ? (
                          <div className="pt-2 w-full overflow-x-auto">
                            {displayMode === "markdown" ? (
                              <MarkdownRenderer>{verText}</MarkdownRenderer>
                            ) : (
                              <div className="whitespace-pre-wrap">{verText}</div>
                            )}
                          </div>
                        ) : (
                          <p className="italic text-sm text-muted-foreground border rounded">
                            No version
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                {!versionEmpty && (
                  <p className="font-semibold">Value</p>
                )}
                <div className="border rounded p-2 relative group max-w-full overflow-hidden">
                  <RowBadge rowNumbers={rowNums} mode="none" />
                  <CopyButton
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    content={textValue}
                    copyMessage="Copied string!"
                    tooltipContent="Copy string"
                  />
                  {textValue ? (
                    <div className="pt-2 w-full overflow-x-auto">
                      {displayMode === "markdown" ? (
                        <MarkdownRenderer>{textValue}</MarkdownRenderer>
                      ) : (
                        <div className="whitespace-pre-wrap">{textValue}</div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No data
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // For lines/words/characters => we do a DiffViewer approach
  const baseStrSafe = toStringSafe(value);
  const { redRows, greenRows } = gatherPresenceDiffs(
    baseStrSafe,
    compStrs,
    baseLogIndex,
    comparisonLogsIndex
  );
  const stringGroups = groupComparablesByValue(compStrs, comparisonLogsIndex);

  return (
    <div className="space-y-4">
      {stringGroups.map((block, i) => {
        const compStr = block.text;
        const rowNums = block.rows;
        let baseBadgeMode: "none" | "delete" = "none";
        if (baseStrSafe !== compStr) {
          baseBadgeMode = "delete";
        }

        const versionGroups = groupVersionsForRows(
          rowNums,
          baseLogIndex,
          baseVerStr,
          comparisonLogsIndex,
          compVerStrs
        );

        return (
          <div key={i} className="space-y-4">
            {!versionEmpty && (
              <div className="space-y-2">
                <p className="font-semibold">Version</p>
                {versionGroups.map((vg, j) => {
                  const verText = vg.text;
                  let oldVal = baseVerStr;
                  let newVal = verText;
                  let oldMode: "none" | "delete" = "none";
                  let newMode: "none" | "insert" = "none";
                  if (oldVal !== newVal) {
                    oldMode = "delete";
                    newMode = "insert";
                  }

                  return (
                    <div key={j} className="space-y-2">
                      <div className="border rounded p-2">
                        <div className="flex items-center gap-2 text-xs">
                          <RowBadge
                            rowNumbers={[baseLogIndex]}
                            mode={oldVal !== newVal ? "delete" : "none"}
                          />
                          <RowBadge
                            rowNumbers={vg.rows}
                            mode={oldVal !== newVal ? "insert" : "none"}
                          />
                        </div>
                        <div>
                          {(() => {
                            const singleLineDiff = !oldVal.includes('\n') && !newVal.includes('\n');
                            return (
                              <DiffViewer
                                oldValue={oldVal}
                                newValue={newVal}
                                splitView={splitView}
                                hideLineNumbers={singleLineDiff}
                                hideMarkers
                                mode={diffMode}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              {!versionEmpty && (
                <p className="font-semibold">String Diff</p>
              )}
            <div className="border rounded p-2 max-w-full overflow-hidden">
              <div className="flex items-center gap-2 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />
                <RowBadge
                  rowNumbers={rowNums}
                  mode={baseStrSafe !== compStr ? "insert" : "none"}
                />
              </div>
              <div className="w-full overflow-x-auto">
                {(() => {
                  const singleLineDiff = !baseStrSafe.includes('\n') && !compStr.includes('\n');
                  return (
                    <DiffViewer
                      oldValue={baseStrSafe}
                      newValue={compStr}
                      splitView={splitView}
                      hideLineNumbers={singleLineDiff}
                      hideMarkers
                      mode={diffMode}
                    />
                  );
                })()}
              </div>
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}