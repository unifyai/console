"use client";

import React, { useState } from "react";
import { LogComparisonProps } from "./types";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";

/**
 * Convert unknown => finite number, defaulting to 0 if not finite.
 */
function asFiniteNumber(val: unknown) {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  return 0;
}

/**
 * If diffMode === "none," we show everything grouped by numeric value
 * (like StringView "none" mode). We'll gather base + comparables => map<number, rowIndices>.
 */
function groupAllNumbersByValue(
  baseVal: unknown,
  comparables: unknown[] | undefined,
  baseRow: number,
  compRows: number[]
) {
  const baseNum = asFiniteNumber(baseVal);
  const compNums = (comparables ?? []).map(asFiniteNumber);
  const allNums = [baseNum, ...compNums];
  const allRows = [baseRow, ...compRows];

  const map = new Map<number, number[]>();
  allNums.forEach((n, i) => {
    if (!map.has(n)) {
      map.set(n, []);
    }
    map.get(n)!.push(allRows[i]);
  });
  // Convert to array: { numVal, rows }
  return Array.from(map.entries()).map(([numVal, rowArr]) => ({
    numVal,
    rows: rowArr.sort((a, b) => a - b),
  }));
}

/**
 * For param version grouping, same logic as in StringView or MatrixView.
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

/**
 * Apply the selected symbol operation:
 * - For "−": result = compVal − baseVal
 * - For "+": result = compVal + baseVal
 * - For "×": result = compVal × baseVal
 * - For "÷": result = compVal / baseVal   (if baseVal=0 => Infinity)
 */
function applySymbol(baseVal: number, compVal: number, symbol: string): number {
  switch (symbol) {
    case "+":
      return compVal + baseVal;
    case "−":
      return compVal - baseVal;
    case "×":
      return compVal * baseVal;
    case "÷":
      return baseVal === 0 ? Infinity : compVal / baseVal;
    default:
      return 0;
  }
}

const symbols = ["−", "+", "×", "÷"] as const;

export default function NumberView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false, // not used further, just included for parity
  version = "",
  comparableVersions = [],
  scientificNotation = false,
  displayMode = "markdown",
}: LogComparisonProps & { scientificNotation?: boolean }) {
  // Single vs. multiple
  const singleMode = !comparables || comparables.length === 0;

  // Version strings
  const baseVer = version || "";
  const compVers = comparableVersions;
  const versionEmpty = !baseVer && compVers.every((s) => !s);

  // Always show base if single-mode
  const baseNum = asFiniteNumber(value);

  // Helper function to format numbers when scientificNotation is enabled
  function formatNumberVal(val: number): string {
    if (scientificNotation && val !== 0 && Math.abs(val) < 0.01) {
      return val.toExponential(2);
    }
    return val.toString();
  }

  // Operation: cycle through symbols
  const [opIndex, setOpIndex] = useState(0);
  const currentSymbol = symbols[opIndex];
  function handleCycleSymbol() {
    setOpIndex((prev) => (prev + 1) % symbols.length);
  }

  /////////////////////////////////////////////////////////////////////////
  // SINGLE MODE => Just show the base number
  /////////////////////////////////////////////////////////////////////////
  if (singleMode) {
    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold">Version</p>
            {baseVer ? (
              <div className="flex p-2 relative border rounded group">
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
          {!versionEmpty && <p className="font-semibold">Value</p>}
          <div className="flex border rounded p-2 relative group">
            <div>
              <p className="text-sm">{formatNumberVal(baseNum)}</p>
            </div>
            <CopyButton
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              content={String(baseNum)}
              copyMessage="Copied number!"
              tooltipContent="Copy number"
            />
          </div>
        </div>
      </div>
    );
  }

  /////////////////////////////////////////////////////////////////////////
  // MULTI-MODE => We have baseNum + comparables
  /////////////////////////////////////////////////////////////////////////

  // If diffMode === "none," group them ignoring base vs. comps (like stringView).
  if (diffMode === "none") {
    const groups = groupAllNumbersByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    return (
      <div className="space-y-4">
        {groups.map((grp, i) => {
          const numVal = grp.numVal;
          const rowNums = grp.rows;

          const verGroups = groupVersionsForRows(
            rowNums,
            baseLogIndex,
            baseVer,
            comparisonLogsIndex,
            compVers
          );

          return (
            <div key={i} className="p-3 space-y-4">
              {!versionEmpty && (
                <div className="space-y-2">
                  <p className="font-semibold">Version</p>
                  {verGroups.map((vg, j) => (
                    <div
                      key={j}
                      className="flex border rounded p-2 relative group"
                    >
                      <RowBadge rowNumbers={vg.rows} mode="none" />
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
                {!versionEmpty && <p className="font-semibold">Value</p>}
                <div className="border rounded p-2 bg-background relative group">
                  <RowBadge rowNumbers={rowNums} mode="none" />
                  <CopyButton
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    content={String(numVal)}
                    copyMessage="Copied number!"
                  />
                  <p className="text-sm mt-2">{formatNumberVal(numVal)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Otherwise (diffMode !== "none"), we do the arithmetic approach
  const compNums = (comparables ?? []).map(asFiniteNumber);

  // Group comparables by numeric value => row sets
  const map = new Map<number, number[]>();
  compNums.forEach((cn, i) => {
    const r = comparisonLogsIndex[i];
    if (!map.has(cn)) {
      map.set(cn, []);
    }
    map.get(cn)!.push(r);
  });
  const compBlocks = Array.from(map.entries()).map(([numVal, rows]) => ({
    numVal,
    rows: rows.sort((a, b) => a - b),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">Operation:</p>
        <button
          className="px-2 py-1 border rounded text-sm hover:bg-muted"
          onClick={handleCycleSymbol}
        >
          {currentSymbol}
        </button>
      </div>

      {compBlocks.map((block, i) => {
        const compVal = block.numVal;
        const rowNums = block.rows;

        // Combine base row + these rows for version listing
        const combinedRows = [baseLogIndex, ...rowNums];
        const versionGroups = groupVersionsForRows(
          combinedRows,
          baseLogIndex,
          baseVer,
          comparisonLogsIndex,
          compVers
        );

        // Evaluate final result: compVal [symbol] base
        const result = applySymbol(baseNum, compVal, currentSymbol);

        return (
          <div key={i} className="border rounded p-3 space-y-4">
            {/* Show param versions if not empty */}
            {!versionEmpty && (
              <div className="space-y-2">
                <p className="font-semibold">Param Version</p>
                {versionGroups.map((vg, j) => {
                  return (
                    <div
                      key={j}
                      className="p-3 border rounded relative group"
                    >
                      <RowBadge rowNumbers={vg.rows} mode="none" />
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

            <div className="space-y-2">
              <div className="flex gap-4 items-center">
                {/* Base */}
                <div className="relative border rounded p-2 w-fit min-w-24 text-start group">
                  <div className="flex-col items-start justify-between gap-5">
                    <CopyButton
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      content={String(baseNum)}
                      copyMessage="Copied base!"
                    />
                    <RowBadge rowNumbers={[baseLogIndex]} mode="none" />
                    <p className="text-sm pt-2">{formatNumberVal(baseNum)}</p>
                  </div>
                </div>

                {/* Symbol */}
                <span className="text-xl font-bold">{currentSymbol}</span>

                {/* Comparable */}
                <div className="relative border rounded p-2 w-fit min-w-24 text-start group">
                  <div className="flex-col items-start justify-between gap-5">
                    <CopyButton
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        content={String(compVal)}
                        copyMessage="Copied comp!"
                    />
                    <RowBadge rowNumbers={rowNums} mode="none" />
                    <p className="text-sm pt-2">{formatNumberVal(compVal)}</p>
                  </div>
                </div>

                <span className="mx-2 text-xl font-bold">=</span>

                {/* Result */}
                <div className="relative border rounded p-2 w-fit min-w-24 text-start bg-background group">
                  <div className="flex flex-col">
                    <CopyButton
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      content={String(result)}
                      copyMessage="Copied result!"
                    />
                    <p className="text-sm">Result</p>
                    <p className="text-sm mt-2">
                      {Number.isFinite(result) 
                        ? formatNumberVal(result)
                        : "∞"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}