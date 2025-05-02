"use client";

import React from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { LogComparisonProps } from "./types";
import { useEditablePrimitive } from "@/hooks/useEditablePrimitive";

/**
 * Convert unknown => string with JSON if object.
 */
function toRawString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  // For arrays/objects, we show them as JSON text:
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

/**
 * If diffMode === "none," we group identical raw strings among base/comparables.
 */
function groupAllRowsByValue(
  baseVal: unknown,
  comparables: unknown[] | undefined,
  baseRow: number,
  compRows: number[]
) {
  const allRaw = [baseVal, ...(comparables ?? [])].map(toRawString);
  const allRowIndices = [baseRow, ...compRows];

  const map = new Map<string, number[]>();
  for (let i = 0; i < allRaw.length; i++) {
    const txt = allRaw[i];
    if (!map.has(txt)) {
      map.set(txt, []);
    }
    map.get(txt)!.push(allRowIndices[i]);
  }
  return Array.from(map.entries()).map(([rawText, rowSet]) => ({
    rawText,
    rows: rowSet.sort((a, b) => a - b),
  }));
}

/**
 * If diffMode !== "none," we show side-by-side diffs, grouping comparables by raw string.
 */
function groupComparableStrings(compStrs: string[], compRows: number[]) {
  const map = new Map<string, number[]>();
  for (let i = 0; i < compStrs.length; i++) {
    const c = compStrs[i];
    const row = compRows[i];
    if (!map.has(c)) {
      map.set(c, []);
    }
    map.get(c)!.push(row);
  }
  return Array.from(map.entries()).map(([text, rows]) => ({
    text,
    rows: rows.sort((a, b) => a - b),
  }));
}

/**
 * Gather row sets that share the same param version text. 
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
  return Array.from(map.entries()).map(([verText, rowArr]) => ({
    verText,
    rows: rowArr.sort((a, b) => a - b),
  }));
}

export default function RawView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
  version = "",
  comparableVersions = [],
  cellEditMode = false,
  onSaveEdit,
  path,
}: LogComparisonProps) {
  const singleMode = !comparables || comparables.length === 0;
  const baseStr = toRawString(value);
  const compStrs = (comparables ?? []).map(toRawString);

  // Param version handling:
  const baseVer = version || "";
  const compVers = comparableVersions || [];
  const versionEmpty = !baseVer && compVers.every((s) => !s);

  // ────────────────────────────────────────────────────────────────────────
  // Edit-mode – allow user to edit the raw string directly
  // ────────────────────────────────────────────────────────────────────────
  if (cellEditMode) {
    const { draft, inputProps } = useEditablePrimitive<string>(baseStr, (newVal) => {
      // ------------------------------------------------------------------
      // Attempt to coerce the edited *string* back to the original type so
      // that switching out of "raw" mode restores the correct renderer
      // (e.g. trace objects remain objects).
      // ------------------------------------------------------------------
      let finalVal: any = newVal;

      // 1) If the original value was an object/array, try JSON.parse
      if (value !== null && typeof value === "object") {
        try {
          // Preserve numbers/booleans where possible inside JSON
          finalVal = JSON.parse(newVal);
        } catch {
          // If parsing fails, keep as raw string – user intends plain text
        }
      } else if (typeof value === "number") {
        // 2) If original was a number, attempt to parse to number
        const maybeNum = Number(newVal);
        if (!Number.isNaN(maybeNum)) {
          finalVal = maybeNum;
        }
      }

      // 3) If the resulting value is "effectively" unchanged (deep-equals), skip
      //    emitting the save to avoid unnecessary churn.
      try {
        const unchanged = JSON.stringify(finalVal) === JSON.stringify(value);
        if (unchanged) return;
      } catch {
        /* best-effort only – continue */
      }

      if (onSaveEdit) {
        onSaveEdit({ source: "entries", path: path ?? [], newValue: finalVal });
      }
    });

    // Always render a textarea to comfortably edit potentially long JSON
    return (
      <textarea
        rows={Math.min(12, Math.max(4, draft.split("\n").length))}
        className="w-full border rounded p-1 text-sm font-mono"
        {...inputProps}
      />
    );
  }

  //----------------------------------------------------------------------
  // SINGLE MODE => just show the base raw text + param version if present
  //----------------------------------------------------------------------
  if (singleMode) {
    return (
      <div className="space-y-4">
        {/* If we have a non-empty version, show it first */}
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold">Version</p>
            {baseVer ? (
              <div className="flex border rounded p-2 relative group">
                <div className="mt-1 mb-1">
                  <p className="text-sm whitespace-pre-wrap">{baseVer}</p>
                </div>
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

        {/* Main raw block */}
        <div className="space-y-2">
          {!versionEmpty && (
            <p className="font-semibold">Value</p>
          )}
          <div className="flex border rounded p-2 relative group">
            <div className="mt-1 mb-1">
              <p className="text-sm whitespace-pre-wrap">{baseStr}</p>
            </div>
            <CopyButton
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              content={baseStr}
              copyMessage="Copied!"
              tooltipContent="Copy raw text"
            />
          </div>
        </div>
      </div>
    );
  }

  //----------------------------------------------------------------------
  // MULTI MODE
  //----------------------------------------------------------------------
  if (diffMode === "none") {
    // Group identical raw text among base + comps
    const groups = groupAllRowsByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    // Filter out groups with empty raw text
    const filteredGroups = groups.filter(group => group.rawText.trim() !== "");

    return (
      <div className="space-y-4">
        {filteredGroups.map((g, i) => {
          // For each distinct raw text
          const rowNums = g.rows;
          // Also group param versions among these rows
          const versionGroups = groupVersionsForRows(
            rowNums,
            baseLogIndex,
            baseVer,
            comparisonLogsIndex,
            compVers
          );

          return (
            <div key={i} className="p-3 space-y-4">
              {/* Param version block if not all empty */}
              {!versionEmpty && (
                <div className="space-y-2">
                  <p className="font-semibold">Version</p>
                  {versionGroups.map((vg, idx) => {
                    const vStr = vg.verText;
                    return (
                      <div key={idx} className="space-y-2 border rounded p-2 relative group">
                        <RowBadge rowNumbers={vg.rows} mode="none" />
                        <CopyButton
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          content={vStr}
                          copyMessage="Copied!"
                          tooltipContent="Copy version"
                        />
                        {vStr ? (
                          <div className="pt-2">
                            <p className="text-sm whitespace-pre-wrap">{vStr}</p>
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

              {/* Raw text block */}
              <div className="space-y-2">
                {!versionEmpty && (
                  <p className="font-semibold">Value</p>
                )}
                <div className="border rounded p-2 relative group">
                  <RowBadge rowNumbers={rowNums} mode="none" />
                  <CopyButton
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    content={g.rawText}
                    copyMessage="Copied!"
                    tooltipContent="Copy raw text"
                  />
                  <div className="pt-2">
                    <p className="text-sm whitespace-pre-wrap">{g.rawText}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  //----------------------------------------------------------------------
  // diffMode !== "none": side-by-side diffs
  //----------------------------------------------------------------------
  // We'll group comparables by their raw text
  const compGroups = groupComparableStrings(compStrs, comparisonLogsIndex);

  return (
    <div className="space-y-4">
      {compGroups.map((block, i) => {
        const same = block.text === baseStr;
        const oldMode = same ? "none" : "delete";
        const newMode = same ? "none" : "insert";

        // Merge base row + these comp rows for version listing
        const combinedRows = [baseLogIndex, ...block.rows];
        const verGroups = groupVersionsForRows(
          combinedRows,
          baseLogIndex,
          baseVer,
          comparisonLogsIndex,
          compVers
        );

        return (
          <div key={i} className="space-y-4">
            {/* Param version if not empty */}
            {!versionEmpty && (
              <div className="space-y-2">
                <p className="font-semibold">Version</p>
                {verGroups.map((vg, j) => {
                  const textVal = vg.verText;
                  const changed = textVal !== baseVer && vg.rows.some(r => r !== baseLogIndex);
                  const baseRowPresent = vg.rows.includes(baseLogIndex);
                  const baseBadge = changed && baseRowPresent ? "delete" : "none";
                  const compBadge = changed && !baseRowPresent ? "insert" : "none";

                  // If multiple comp rows, we just unify them as "insert" 
                  // for any that differ from base
                  return (
                    <div key={j} className="borderspace-y-2">
                      <div className="border rounded p-2">
                        <div className="flex items-centergap-2 gap-2 text-xs">
                          {baseRowPresent && <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadge} />}
                          <RowBadge rowNumbers={vg.rows.filter(r => r !== baseLogIndex)} mode={changed ? "insert" : "none"} />
                        </div>
                        <div>
                          {(() => {
                            const singleLineDiff = !baseVer.includes('\n') && !textVal.includes('\n');
                            return (
                              <DiffViewer
                                oldValue={baseVer}
                                newValue={textVal}
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

            {/* Diff of raw text itself */}
            <div className="space-y-2">
              {!versionEmpty && (
                <p className="font-semibold">Raw Diff</p>
              )}
              <div className="border rounded p-2">
                <div className="flex items-center gap-2 text-xs">
                  <RowBadge rowNumbers={[baseLogIndex]} mode={oldMode} />
                  <RowBadge rowNumbers={block.rows} mode={newMode} />
                </div>
                <div>
                  {(() => {
                    const singleLineDiff = !baseStr.includes('\n') && !block.text.includes('\n');
                    return (
                      <DiffViewer
                        oldValue={baseStr}
                        newValue={block.text}
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