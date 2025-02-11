"use client";

import React from "react";
import { LogComparisonProps } from "./types";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";

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

  const days = Math.floor(absMs / 86400000); // 24*60*60*1000
  absMs = absMs % 86400000;
  const hours = Math.floor(absMs / 3600000); // 60*60*1000
  absMs = absMs % 3600000;
  const minutes = Math.floor(absMs / 60000); // 60*1000
  absMs = absMs % 60000;
  const seconds = Math.floor(absMs / 1000);
  const ms = absMs % 1000;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} days`);
  if (hours > 0) parts.push(`${hours} hours`);
  if (minutes > 0) parts.push(`${minutes} minutes`);
  if (seconds > 0) parts.push(`${seconds} seconds`);
  if (ms > 0) parts.push(`${ms} ms`);

  if (parts.length === 0) {
    return signChar + " 0 ms"; // If no difference, show sign and "0 ms"
  }
  return signChar + " " + parts.join(", ");
}

export default function TimestampView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView, // Not used, just for compatibility
  version = "",
  comparableVersions = [],
}: LogComparisonProps) {
  // Single vs multiple
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
                  <MarkdownRenderer>{baseVer}</MarkdownRenderer>
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
              <p className="text-sm">{formatHumanReadable(baseStr)}</p>
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
    const allTimestamps = [baseStr, ...(comparables ?? []).map(String)];
    const rowIdxs = [baseLogIndex, ...comparisonLogsIndex];

    const map = new Map<string, number[]>();
    allTimestamps.forEach((ts, i) => {
      if (!map.has(ts)) map.set(ts, []);
      map.get(ts)!.push(rowIdxs[i]);
    });

    const groupArr = Array.from(map.entries()).map(([ts, rows]) => ({
      ts,
      rows: rows.sort((a, b) => a - b),
    }));

    return (
      <div className="space-y-4">
        {groupArr.map((group, idx) => {
          const tsVal = group.ts;
          const rowNumbers = group.rows;

          return (
            <div key={idx} className="p-3 space-y-4">
              {!versionEmpty && (
                <div>
                  <p className="font-semibold text-sm mb-4">Version</p>
                  <div className="space-y-2">
                    {rowNumbers.map((r) => {
                      const isBase = r === baseLogIndex;
                      const verText = isBase
                        ? baseVer
                        : compVers[comparisonLogsIndex.indexOf(r)] ?? "";
                      return (
                        <div key={r} className="border rounded p-2 relative group">
                          <RowBadge rowNumbers={[r]} mode="none" />
                          {verText ? (
                            <div className="pt-2">
                              <MarkdownRenderer>{verText}</MarkdownRenderer>
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

        return (
          <div key={idx} className="p-3 space-y-4">
            {/* Param versions if not empty */}
            {!versionEmpty && (
              <div className="space-y-2">
                <p className="font-semibold text-sm">Version</p>
                {joinedRows.map((r) => {
                  const isBase = r === baseLogIndex;
                  const verText = isBase
                    ? baseVer
                    : compVers[comparisonLogsIndex.indexOf(r)] ?? "";
                  return (
                    <div key={r} className="border rounded p-2 relative group">
                      <RowBadge rowNumbers={[r]} mode="none" />
                      {verText ? (
                        <div className="pt-2">
                          <MarkdownRenderer>{verText}</MarkdownRenderer>
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