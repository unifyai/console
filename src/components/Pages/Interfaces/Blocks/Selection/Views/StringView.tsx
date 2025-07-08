"use client";

import React from "react";
import { showErrorToast } from "@/components/Common/Toasts/notifications";
import { useEditablePrimitive } from "@/hooks/Interfaces/useEditablePrimitive";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import Tooltip from "@/components/Common/Misc/Tooltip";

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

// Helper Component for a single editable field, now aware of its group
const EditableStringField = ({
  initialValue,
  logIndices, // Pass all log indices for this group
  path,
  onGroupSave, // Use a group-aware save handler
  isImmutable
}: {
  initialValue: string;
  logIndices: number[]; // Indices sharing this value
  path: (string | number)[];
  onGroupSave: (desc: { logIndices: number[]; path: (string | number)[]; newValue: any }) => void; // Handler accepts multiple indices
  isImmutable?: boolean
}) => {
  const { draft, inputProps } = useEditablePrimitive<string>(
    initialValue,
    (newValue) => {
      // Call the group save handler with all associated indices
      onGroupSave({ logIndices, path, newValue });
    }
  );

  const isMultiLine = draft.length > 80;

  return (isImmutable
    ? <Tooltip content="Immutable field cannot be edited">
        <div>
          {isMultiLine ? (
            <textarea 
              className="w-full border rounded p-1 text-sm font-mono"
              rows={4}
              disabled
              {...inputProps}
            />
          ) : (
            <input 
              style={{
                backgroundImage: "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--foreground) 20%, transparent) 0 1px, transparent 1px 6px)"
              }}
              className="w-full border rounded p-1 text-sm font-mono"
              type="text"
              disabled 
              {...inputProps}
            />
          )}
        </div>
      </Tooltip>
    :  <div>
        {isMultiLine ? (
          <textarea 
            rows={4} 
            className="w-full border rounded p-1 text-sm font-mono bg-input text-foreground"
            {...inputProps}
          />
        ) : (
          <input 
            type="text"
              className="w-full border rounded p-1 text-sm font-mono bg-input text-foreground"
            {...inputProps}
          />
        )}
      </div>
  );
};


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
  onSaveEdit, // Expects { logIndex: number, path: ..., newValue: ... }
  onGroupSaveEdit, // Expects { logIndices: number[], path: ..., newValue: ... }
  path = [],
  nested = false,
  isImmutable
}: LogComparisonProps  & { nested?: boolean, isImmutable?: boolean }) {
  // Prepare string values
  const singleMode = !comparables || comparables.length === 0;

  // If editable => render editable fields
  if (cellEditMode && (onSaveEdit || onGroupSaveEdit)) {
    const baseStr = toStringSafe(value);

    // Group values by string content
    const valueGroups = groupAllByValue(
      baseStr,
      comparables,
      baseLogIndex,
      comparisonLogsIndex
    );

     // Define the handler that will be called by EditableStringField's onSave
    const handleGroupSave = ({ logIndices, path, newValue }: { logIndices: number[]; path: (string | number)[]; newValue: any }) => {
        if (onGroupSaveEdit) {
            // Call the group save handler directly with all indices
            onGroupSaveEdit({ logIndices, path, newValue });
        } else if (onSaveEdit && logIndices.length > 0) {
            // Fallback: Call single save for the first index if group save handler is not provided
            // This might happen if the parent component doesn't implement onGroupSaveEdit yet
            console.warn("Using single onSaveEdit for grouped field. Consider implementing onGroupSaveEdit.");
            onSaveEdit({ logIndex: logIndices[0], path, newValue });
        }
    };

    return (
        <div className="space-y-3">
            {valueGroups.map((group, index) => (
                <div key={index}>
                    {/* Display RowBadges for the logs sharing this value */}
                    {!nested &&
                    <div className="flex items-center gap-1 mb-1">
                        <RowBadge rowNumbers={group.rows} mode="none" />
                        <span className="text-xs text-muted-foreground">
                            {group.rows.length > 1 ? `(${group.rows.length} logs)` : ""}
                        </span>
                    </div>}
                    {/* Render a single editable field for this group */}
                    <EditableStringField
                        initialValue={group.text}
                        logIndices={group.rows}
                        path={path}
                        onGroupSave={handleGroupSave}
                        isImmutable={isImmutable}
                    />
                </div>
            ))}
        </div>
    );
  }

  // --- Read-only rendering logic ---
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
          <p className="italic text-sm text-muted-foreground">No value</p>
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