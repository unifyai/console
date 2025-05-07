"use client";

import React from "react";
import { LogComparisonProps } from "./types";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";
import { useEditablePrimitive } from "@/hooks/useEditablePrimitive";
import { toast } from "sonner";

/**
 * parseTimestamp: Convert a string to a Date. If invalid, returns null.
 */
function parseTimestamp(ts: string): Date | null {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * formatHumanReadable: Shows a Date in a more readable format (UTC-based).
 * If invalid, returns "(invalid date)".
 */
function formatHumanReadable(ts: string): string {
  const parsed = parseTimestamp(ts);
  if (!parsed) return "(invalid date)";
  return parsed.toUTCString(); // e.g. "Fri, 22 Sep 2023 16:34:22 GMT"
}

/**
 * buildTimedeltaString: given (compDate - baseDate) in ms,
 * produce a string like "+ 3 days, 7 minutes" or "- 2 hours, 5 ms", etc.
 */
function buildTimedeltaString(baseStr: string, compStr: string): string {
  const baseDate = parseTimestamp(baseStr);
  const compDate = parseTimestamp(compStr);
  if (!baseDate || !compDate) return "(invalid difference)";

  let deltaMs = compDate.getTime() - baseDate.getTime();
  const signChar = deltaMs >= 0 ? "+" : "-";
  let absMs = Math.abs(deltaMs);

  const days = Math.floor(absMs / 86400000);
  absMs = absMs % 86400000;

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  const hours = Math.floor(absMs / 3600000);
  absMs = absMs % 3600000;
  const minutes = Math.floor(absMs / 60000);
  absMs = absMs % 60000;
  const seconds = Math.floor(absMs / 1000);
  const ms = absMs % 1000;

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks} weeks`);
  if (remainingDays > 0) parts.push(`${remainingDays} days`);
  if (hours > 0) parts.push(`${hours} hours`);
  if (minutes > 0) parts.push(`${minutes} minutes`);
  if (seconds > 0) parts.push(`${seconds} seconds`);
  if (ms > 0) parts.push(`${ms} ms`);

  if (parts.length === 0) {
    return signChar + " 0 ms";
  }
  return signChar + " " + parts.join(", ");
}

// Grouping helper for no-diff and edit mode
function groupAllTimestampsByValue(
  baseVal: unknown,
  comparables: unknown[] | undefined,
  baseRow: number,
  compRows: number[]
) {
  const allTimestamps = [baseVal, ...(comparables ?? [])].map(ts => String(ts ?? ""));
  const allRows = [baseRow, ...compRows];

  const map = new Map<string, number[]>();
  allTimestamps.forEach((tsStr, i) => {
    if (!map.has(tsStr)) {
      map.set(tsStr, []);
    }
    map.get(tsStr)!.push(allRows[i]);
  });
  // Convert to array: { tsVal, rows }
  return Array.from(map.entries()).map(([tsVal, rowArr]) => ({
    tsVal,
    rows: rowArr.sort((a, b) => a - b),
  }));
}

// Grouping helper for versions (used in read-only modes)
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

// Helper Component for a single editable timestamp field, group-aware
const EditableTimestampField = ({
  initialValue,
  logIndices, // Pass all log indices for this group
  path,
  onGroupSave, // Use a group-aware save handler
}: {
  initialValue: string;
  logIndices: number[]; // Indices sharing this value
  path: (string | number)[];
  onGroupSave: (desc: { logIndices: number[]; path: (string | number)[]; newValue: any }) => void; // Handler accepts multiple indices
}) => {
  const { draft, inputProps } = useEditablePrimitive<string>(
    initialValue,
    (newValue) => {
      // Attempt to parse the date to ensure it's valid before saving
      const parsedDate = parseTimestamp(newValue);
      if (parsedDate) {
        onGroupSave({ logIndices, path, newValue: newValue }); // Save the valid string
      } else {
        toast.error("Invalid timestamp format. Changes not saved.");
      }
    },
    (val) => parseTimestamp(val) ? true : "Invalid timestamp format" // Validation function
  );

  return (
    <input
      type="text"
      placeholder="e.g., YYYY-MM-DDTHH:mm:ssZ or RFC2822"
      className="w-full border rounded p-1 text-sm font-mono bg-input text-foreground"
      {...inputProps}
      value={draft} // Use the draft value directly
    />
  );
};


export default function TimestampView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView, // Not used, just for compatibility
  version = "",
  comparableVersions = [],
  displayMode = "markdown",
  cellEditMode = false,
  onSaveEdit,
  onGroupSaveEdit, 
  path = [],
  nested = false,
}: LogComparisonProps & { nested?: boolean }) {

  // If editable, group and render editable fields
  if (cellEditMode && (onSaveEdit || onGroupSaveEdit)) {
    const timestampGroups = groupAllTimestampsByValue(
        value,
        comparables,
        baseLogIndex,
        comparisonLogsIndex
    );

    // Filter out groups with empty or clearly invalid initial values before rendering inputs
    // We still allow editing potentially invalid formats entered by the user.
    const validGroups = timestampGroups.filter(group => group.tsVal.trim() !== "");

    // Define the handler that will be called by EditableTimestampField's onSave
    const handleGroupSave = ({ logIndices, path, newValue }: { logIndices: number[]; path: (string | number)[]; newValue: any }) => {
      if (onGroupSaveEdit) {
        // Call the group save handler directly with all indices
        onGroupSaveEdit({ logIndices, path, newValue });
      } else if (onSaveEdit && logIndices.length > 0) {
        // Fallback: Call single save for the first index if group save handler is not provided
        console.warn("Using single onSaveEdit for grouped timestamp field. Consider implementing onGroupSaveEdit.");
        onSaveEdit({ logIndex: logIndices[0], path, newValue });
      }
    };

    return (
        <div className="space-y-3">
            {validGroups.map((group, index) => (
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
                    <EditableTimestampField
                        initialValue={group.tsVal} // Pass the timestamp string
                        logIndices={group.rows} // Pass the indices associated with this group
                        path={path}
                        onGroupSave={handleGroupSave} // Pass the group save handler
                    />
                </div>
            ))}
        </div>
    );
  }


  // --- Read-only rendering logic ---
  const singleMode = !comparables || comparables.length === 0;
  const baseStr = typeof value === "string" ? value : String(value || "");

  const baseVer = version || "";
  const compVers = comparableVersions;
  const versionEmpty = !baseVer && compVers.every((s) => !s);

  //----------------------------------------
  // SINGLE MODE => Just show the base timestamp
  //----------------------------------------
  if (singleMode) {
    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold text-sm">Version</p>
            {baseVer ? (
              <div className="flex relative p-2 border rounded group">
                <div>
                  {displayMode === "markdown" ? (
                    <MarkdownRenderer>{baseVer}</MarkdownRenderer>
                  ) : (
                    baseVer
                  )}
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

        <div className="space-y-2">
          {!versionEmpty && <p className="font-semibold text-sm">Value</p>}
          <div className="flex border rounded p-2 relative group">
            <div>
              {displayMode === "markdown" ? (
                <MarkdownRenderer>{formatHumanReadable(baseStr)}</MarkdownRenderer>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{formatHumanReadable(baseStr)}</p>
              )}
            </div>
            <CopyButton
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              content={baseStr}
              copyMessage="Copied timestamp!"
              tooltipContent="Copy timestamp"
            />
          </div>
        </div>
      </div>
    );
  }

  //----------------------------------------
  // MULTI MODE
  // If diffMode === "none," group them (like StringView "none" mode)
  //----------------------------------------
  if (diffMode === "none") {
    const groupArr = groupAllTimestampsByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    // Filter out groups with empty or invalid timestamps
    const filteredGroups = groupArr.filter(group => {
      if (!group.tsVal || group.tsVal.trim() === "") return false;
      const parsedTimestamp = parseTimestamp(group.tsVal);
      return parsedTimestamp !== null;
    });

    return (
      <div className="space-y-4">
        {filteredGroups.map((group, idx) => {
          const tsVal = group.tsVal;
          const rowNumbers = group.rows;
          const verGroups = groupVersionsForRows(rowNumbers, baseLogIndex, baseVer, comparisonLogsIndex, compVers);

          return (
            <div key={idx} className="p-3 space-y-4">
              {!versionEmpty && (
                <div>
                  <p className="font-semibold text-sm mb-4">Version</p>
                  <div className="space-y-2">
                    {verGroups.map((vg, j) => (
                      <div key={j} className="border rounded p-2 relative group">
                        <RowBadge rowNumbers={vg.rows} mode="none" />
                        {vg.text ? (
                          <div className="pt-2">
                            {displayMode === "markdown" ? (
                              <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                            ) : (
                              vg.text
                            )}
                          </div>
                        ) : (
                          <p className="italic text-sm text-muted-foreground pt-2">
                            No version
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!versionEmpty && (
                <p className="font-semibold text-sm">Value</p>
              )}
              <div className="relative border rounded p-2 group">
                <RowBadge rowNumbers={rowNumbers} mode="none" />
                <CopyButton
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  content={tsVal}
                  copyMessage="Copied timestamp!"
                />
                <p className="text-sm mt-1 mb-1">{formatHumanReadable(tsVal)}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Otherwise (diffMode !== "none"), treat each distinct comparable
  const allComps = (comparables ?? []).map(String);
  const map = new Map<string, number[]>();
  allComps.forEach((ts, i) => {
    const row = comparisonLogsIndex[i];
    // Skip adding empty or invalid timestamps to the map
    if (!ts || ts.trim() === "") return;
    const parsedTimestamp = parseTimestamp(ts);
    if (parsedTimestamp === null) return;

    if (!map.has(ts)) map.set(ts, []);
    map.get(ts)!.push(row);
  });
  const compGroups = Array.from(map.entries()).map(([tsVal, rows]) => ({
    tsVal,
    rows: rows.sort((a, b) => a - b),
  }));

  return (
    <div className="space-y-4">
      {compGroups.map((group, idx) => {
        const compStr = group.tsVal;
        const rowNumbers = group.rows;

        const joinedRows = [baseLogIndex, ...rowNumbers];
        const diff = buildTimedeltaString(baseStr, compStr);
        const verGroups = groupVersionsForRows(joinedRows, baseLogIndex, baseVer, comparisonLogsIndex, compVers);

        return (
          <div key={idx} className="p-3 space-y-4">
            {/* Param versions if not empty */}
            {!versionEmpty && (
              <div className="space-y-2">
                <p className="font-semibold text-sm">Version</p>
                {verGroups.map((vg, j) => (
                    <div key={j} className="border rounded p-2 relative group">
                      <RowBadge rowNumbers={vg.rows} mode="none" />
                      {vg.text ? (
                        <div className="pt-2">
                          {displayMode === "markdown" ? (
                            <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                          ) : (
                            vg.text
                          )}
                        </div>
                      ) : (
                        <p className="italic text-sm text-muted-foreground pt-2">
                          No version
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!versionEmpty && (
                <p className="font-semibold text-sm">Value</p>
              )}
              <div className="flex items-center gap-2">
                {/* Base block */}
                <div className="relative border p-2 rounded group">
                  <RowBadge rowNumbers={[baseLogIndex]} mode="none" />
                  <p className="mt-4 text-sm">{formatHumanReadable(baseStr)}</p>
                  <CopyButton
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    content={baseStr}
                    copyMessage="Copied timestamp!"
                  />
                </div>

                {/* → Arrow */}
                <div className="font-bold text-xl mx-2">→</div>

                {/* Comparable block */}
                <div className="relative border p-2 rounded group">
                  <RowBadge rowNumbers={rowNumbers} mode="none" />
                  <p className="mt-4 text-sm">{formatHumanReadable(compStr)}</p>
                  <CopyButton
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    content={compStr}
                    copyMessage="Copied timestamp!"
                  />
                </div>

                {/* = difference */}
                <div className="font-bold text-xl mx-2">=</div>

                {/* Difference block */}
                <div className="relative border p-2 rounded min-w-24 group">
                  <p className="font-semibold text-sm">Diff</p>
                  <p className="mt-4 text-sm">{diff}</p>
                  <CopyButton
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    content={diff}
                    copyMessage="Copied diff!"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}