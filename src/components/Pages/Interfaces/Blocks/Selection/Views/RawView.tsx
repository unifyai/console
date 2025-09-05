"use client";

import React from "react";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { LogComparisonProps } from "./types";
import { useEditablePrimitive } from "@/hooks/Interfaces/useEditablePrimitive";

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

// Helper Component for a single editable raw field, group-aware
const EditableRawField = ({
  initialValue,
  logIndices, // Pass all log indices for this group
  path,
  onGroupSave, // Use a group-aware save handler
  originalValue // Pass the original pre-stringified value for type coercion
}: {
  initialValue: string;
  logIndices: number[]; // Indices sharing this value
  path: (string | number)[];
  onGroupSave: (desc: { logIndices: number[]; path: (string | number)[]; newValue: any }) => void; // Handler accepts multiple indices
  originalValue: any; // Original value before stringification
}) => {
  const { draft, inputProps } = useEditablePrimitive<string>(
    initialValue,
    (newVal) => {
      // Attempt to coerce back to original type
      let finalVal: any = newVal;
      if (originalValue !== null && typeof originalValue === "object") {
        try { finalVal = JSON.parse(newVal); } catch { /* Keep as string */ }
      } else if (typeof originalValue === "number") {
        const maybeNum = Number(newVal);
        if (!Number.isNaN(maybeNum)) { finalVal = maybeNum; }
      } else if (typeof originalValue === 'boolean') {
        if (newVal.toLowerCase() === 'true') finalVal = true;
        else if (newVal.toLowerCase() === 'false') finalVal = false;
        // else keep as string if not clearly boolean
      }
      // Check if effectively unchanged before saving
      try {
        const unchanged = JSON.stringify(finalVal) === JSON.stringify(originalValue);
        if (unchanged) return;
      } catch { /* Continue */ }

      onGroupSave({ logIndices, path, newValue: finalVal });
    }
  );

   // Always render a textarea to comfortably edit potentially long JSON
  return (
    <textarea
      rows={Math.min(12, Math.max(4, draft.split("\n").length))}
      className="w-full border rounded p-1 text-body font-mono bg-input text-foreground"
      {...inputProps}
      value={draft} // Use the draft value directly
    />
  );
};


/**
 * If diffMode === "none," we group identical raw strings among base/comparables.
 */
function groupAllRowsByValue(
  baseVal: unknown,
  comparables: unknown[] | undefined,
  baseRow: number,
  compRows: number[]
) {
  // Store original values alongside stringified versions for edit coercion
  const allData = [
    { val: baseVal, str: toRawString(baseVal), idx: baseRow },
    ...(comparables ?? []).map((c, i) => ({ val: c, str: toRawString(c), idx: compRows[i] }))
  ];

  const map = new Map<string, { originalValue: any, rows: number[] }>();
  for (const item of allData) {
    if (!map.has(item.str)) {
      // Store the first encountered original value for this string representation
      map.set(item.str, { originalValue: item.val, rows: [] });
    }
    map.get(item.str)!.rows.push(item.idx);
  }
  return Array.from(map.entries()).map(([rawText, data]) => ({
    rawText,
    originalValue: data.originalValue, // Keep the original value for edit coercion
    rows: data.rows.sort((a, b) => a - b),
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
  onGroupSaveEdit, 
  path = [],
}: LogComparisonProps) {

  // ────────────────────────────────────────────────────────────────────────
  // Edit-mode – allow user to edit the raw string directly
  // ────────────────────────────────────────────────────────────────────────
  if (cellEditMode && (onSaveEdit || onGroupSaveEdit)) {
      const rawGroups = groupAllRowsByValue(
          value,
          comparables,
          baseLogIndex,
          comparisonLogsIndex
      );

      // Define the handler that will be called by EditableRawField's onSave
      const handleGroupSave = ({ logIndices, path, newValue }: { logIndices: number[]; path: (string | number)[]; newValue: any }) => {
          if (onGroupSaveEdit) {
              // Call the group save handler directly with all indices
              onGroupSaveEdit({ logIndices, path, newValue });
          } else if (onSaveEdit && logIndices.length > 0) {
              // Fallback: Call single save for the first index if group save handler is not provided
              console.warn("Using single onSaveEdit for grouped raw field. Consider implementing onGroupSaveEdit.");
              onSaveEdit({ logIndex: logIndices[0], path, newValue });
          }
      };

      return (
          <div className="space-y-3">
              {rawGroups.map((group, index) => (
                  <div key={index}>
                      {/* Display RowBadges for the logs sharing this value */}
                      <div className="flex items-center gap-1 mb-1">
                          <RowBadge rowNumbers={group.rows} mode="none" />
                          <span className="text-caption text-muted-foreground">
                              {group.rows.length > 1 ? `(${group.rows.length} logs)` : ""}
                          </span>
                      </div>
                      {/* Render a single editable field for this group */}
                      <EditableRawField
                          initialValue={group.rawText}
                          logIndices={group.rows} // Pass the indices associated with this group
                          path={path}
                          onGroupSave={handleGroupSave} // Pass the group save handler
                          originalValue={group.originalValue} // Pass original value for type coercion
                      />
                  </div>
              ))}
          </div>
      );
  }

  //----------------------------------------------------------------------
  // READ-ONLY MODE
  //----------------------------------------------------------------------
  const singleMode = !comparables || comparables.length === 0;
  const baseStr = toRawString(value);
  const compStrs = (comparables ?? []).map(toRawString);
  const baseVer = version || "";
  const compVers = comparableVersions || [];
  const versionEmpty = !baseVer && compVers.every((s) => !s);


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
                  <p className="text-body whitespace-pre-wrap">{baseVer}</p>
                </div>
                <CopyButton
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  content={baseVer}
                  copyMessage="Copied version!"
                  tooltipContent="Copy version"
                />
              </div>
            ) : (
              <p className="italic text-body text-muted-foreground">No version</p>
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
              <p className="text-body whitespace-pre-wrap">{baseStr}</p>
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
                            <p className="text-body whitespace-pre-wrap">{vStr}</p>
                          </div>
                        ) : (
                          <p className="italic text-body text-muted-foreground">
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
                    <p className="text-body whitespace-pre-wrap">{g.rawText}</p>
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
                        <div className="flex items-centergap-2 gap-2 text-caption">
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
                <div className="flex items-center gap-2 text-caption">
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