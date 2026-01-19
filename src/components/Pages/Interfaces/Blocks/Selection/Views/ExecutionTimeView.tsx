'use client';

import React from 'react';
import { LogComparisonProps } from './types';
import RowBadge from './RowBadge';
import { CopyButton } from '@/components/Common/Buttons/Copy';

/*────────────────────────────────────────────────────────────────────────────
  formatTime & formatTimeNumber
────────────────────────────────────────────────────────────────────────────*/
// Given a seconds value, choose the most appropriate unit:
//   • if seconds < 0.001    → microseconds (µs)
//   • if seconds < 1        → milliseconds (ms)
//   • if seconds < 60       → seconds (s)
//   • if seconds < 3600     → minutes (min)
//   • otherwise             → hours (h)
function formatTime(seconds: number): { value: number; unit: string } {
  if (seconds < 0.001) {
    return { value: seconds * 1e6, unit: 'µs' };
  } else if (seconds < 1) {
    return { value: seconds * 1000, unit: 'ms' };
  } else if (seconds < 60) {
    return { value: seconds, unit: 's' };
  } else if (seconds < 3600) {
    return { value: seconds / 60, unit: 'min' };
  } else {
    return { value: seconds / 3600, unit: 'h' };
  }
}

function formatTimeNumber(seconds: number): string {
  const { value, unit } = formatTime(seconds);
  return `${value.toFixed(2)} ${unit}`;
}

/*────────────────────────────────────────────────────────────────────────────
  buildTimeDiffString
────────────────────────────────────────────────────────────────────────────*/
// Given a base value and a comparable value (both in seconds), work out the
// difference and return a string (e.g. "+ 350.00 ms" or "– 2.50 min") using the
// most appropriate unit.
function buildTimeDiffString(base: number, comp: number): string {
  const diff = comp - base;
  const sign = diff >= 0 ? '+' : '-';
  const absDiff = Math.abs(diff);
  return `${sign} ${formatTimeNumber(absDiff)}`;
}

/*────────────────────────────────────────────────────────────────────────────
  groupComparablesByFormattedTime
────────────────────────────────────────────────────────────────────────────*/
// Given an array of comparable execution times (in seconds) and their
// corresponding row indices, group those whose formatted (human‐readable)
// values match.
function groupComparablesByFormattedTime(comparables: number[], compIndexes: number[]) {
  const map = new Map<string, number[]>();
  comparables.forEach((sec, i) => {
    const formatted = formatTimeNumber(sec);
    if (!map.has(formatted)) {
      map.set(formatted, []);
    }
    map.get(formatted)!.push(compIndexes[i]);
  });
  return Array.from(map.entries()).map(([formatted, rows]) => ({
    formatted,
    rows: rows.sort((a, b) => a - b),
  }));
}

/*────────────────────────────────────────────────────────────────────────────
  ExecutionTimeView
────────────────────────────────────────────────────────────────────────────*/
// This view behaves as follows:
//   • In single–mode (only a base value is present): it just shows the execution
//     time in the most appropriate unit along with a copy button.
//   • In multi–mode with diffMode === "none": it groups the base and comparable
//     execution times by their formatted value and displays the grouped results.
//   • In diff mode (diffMode not equal to "none"): it uses DiffViewer to show a
//     side–by–side diff. It renders a row with a "Base" block (for the base value),
//     an arrow "→", a "Comparable" block (for the grouped new value) and then a diff
//     block that uses DiffViewer to show the difference (with the appropriate unit).
// A version panel is rendered on top (if version or comparableVersions are provided).
export default function ExecutionTimeView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = 'none',
  splitView = false,
  version = '',
  comparableVersions = [],
  displayMode = 'markdown',
}: LogComparisonProps) {
  // Convert the base value to a number (assume seconds) with a fallback to 0.
  const baseTime = typeof value === 'number' ? value : parseFloat(value as string) || 0;

  // Prepare comparables as numbers (seconds).
  let compTimes: number[] = [];
  if (comparables && comparables.length > 0) {
    compTimes = comparables.map((v) => (typeof v === 'number' ? v : parseFloat(v as string) || 0));
  }

  const singleMode = !comparables || comparables.length === 0;

  // SINGLE MODE: Show only the base execution time.
  if (singleMode) {
    return (
      <div className="space-y-4">
        {version && (
          <div className="space-y-2">
            <p className="text-title">Version</p>
            {version ? (
              <div className="group relative flex rounded border p-2">
                <p className="text-body">{version}</p>
                <CopyButton
                  className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  content={version}
                  copyMessage="Copied version!"
                  tooltipContent="Copy version"
                />
              </div>
            ) : (
              <p className="text-body italic text-muted-foreground">No version</p>
            )}
          </div>
        )}
        <div className="space-y-2">
          {version && <p className="text-title">Value</p>}
          <div className="group relative flex rounded border p-2">
            <p className="text-body">{formatTimeNumber(baseTime)}</p>
            <CopyButton
              className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              content={baseTime.toString()}
              copyMessage="Copied execution time!"
              tooltipContent="Copy execution time"
            />
          </div>
        </div>
      </div>
    );
  }

  // MULTI MODE, diffMode === "none": Group base and comparable times together.
  if (diffMode === 'none') {
    // Group by formatted value.
    const allTimes = [formatTimeNumber(baseTime), ...compTimes.map((t) => formatTimeNumber(t))];
    const allRows = [baseLogIndex, ...comparisonLogsIndex];
    const map = new Map<string, number[]>();
    allTimes.forEach((tStr, i) => {
      if (!map.has(tStr)) {
        map.set(tStr, []);
      }
      map.get(tStr)!.push(allRows[i]);
    });
    const groups = Array.from(map.entries()).map(([time, rows]) => ({
      time,
      rows: rows.sort((a, b) => a - b),
    }));

    return (
      <div className="space-y-4">
        {(version || comparableVersions.some((s) => !!s)) && (
          <div>
            <p className="text-title mb-4">Version</p>
            <div className="space-y-2">
              {[baseLogIndex, ...comparisonLogsIndex].map((r) => {
                const isBase = r === baseLogIndex;
                const verText = isBase
                  ? version
                  : comparableVersions[comparisonLogsIndex.indexOf(r)] || '';
                return (
                  <div key={r} className="group relative rounded border p-2">
                    <RowBadge rowNumbers={[r]} mode="none" />
                    {verText ? (
                      <div className="pt-2">
                        <p className="text-body">{verText}</p>
                      </div>
                    ) : (
                      <p className="text-body italic text-muted-foreground">No version</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {groups.map((grp, idx) => (
          <div key={idx} className="space-y-4 p-3">
            <div className="group relative rounded border p-2">
              <RowBadge rowNumbers={grp.rows} mode="none" />
              <CopyButton
                className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                content={grp.time}
                copyMessage="Copied execution time!"
                tooltipContent="Copy execution time"
              />
              <p className="text-body mb-1 mt-1">{grp.time}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // MULTI MODE with diffMode !== "none":
  // Group comparables by their formatted time value.
  const compGroups = groupComparablesByFormattedTime(compTimes, comparisonLogsIndex);

  return (
    <div className="space-y-4">
      {(version || comparableVersions.some((s) => !!s)) && (
        <div>
          <p className="mb-4 text-sm font-semibold">Version</p>
          <div className="space-y-2">
            {[baseLogIndex, ...comparisonLogsIndex].map((r) => {
              const isBase = r === baseLogIndex;
              const verText = isBase
                ? version
                : comparableVersions[comparisonLogsIndex.indexOf(r)] || '';
              return (
                <div key={r} className="group relative rounded border p-2">
                  <RowBadge rowNumbers={[r]} mode="none" />
                  {verText ? (
                    <div className="pt-2">
                      <p className="text-sm">{verText}</p>
                    </div>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">No version</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {compGroups.map((grp, idx) => {
          const diffStr = buildTimeDiffString(baseTime, parseFloat(grp.formatted));

          return (
            <div key={idx} className="flex items-center gap-2">
              {/* Base block */}
              <div className="group relative min-w-24 flex-col rounded border p-2">
                <RowBadge rowNumbers={[baseLogIndex]} mode="none" />
                <p className="text-sm">{formatTimeNumber(baseTime)}</p>
                <CopyButton
                  className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  content={baseTime.toString()}
                  copyMessage="Copied base execution time!"
                  tooltipContent="Copy base execution time"
                />
              </div>
              <div className="mx-2 text-xl font-bold">→</div>
              {/* Comparable block */}
              <div className="group relative min-w-24 flex-col rounded border p-2">
                <RowBadge rowNumbers={grp.rows} mode="none" />
                <p className="text-sm">{grp.formatted}</p>
                <CopyButton
                  className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  content={grp.formatted}
                  copyMessage="Copied execution time!"
                  tooltipContent="Copy execution time"
                />
              </div>
              <div className="mx-2 text-xl font-bold">=</div>
              {/* Diff block */}
              <div className="group relative min-w-24 flex-col rounded border p-2">
                <p className="text-title">Diff</p>
                <p className="text-body">{diffStr}</p>
                <CopyButton
                  className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  content={diffStr}
                  copyMessage="Copied diff!"
                  tooltipContent="Copy diff"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
