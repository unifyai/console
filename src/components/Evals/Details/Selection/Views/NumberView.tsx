"use client";

import React, { useState } from "react";
import { LogComparisonProps } from "./types";
import RowBadge from "./RowBadge";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import MarkdownRenderer from "./MarkdownRenderer";

/**
 * Convert unknown => finite number or undefined if not a valid number.
 */
function asFiniteNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  return undefined;
}

/**
 * Display value for a number or undefined
 */
function displayValue(val: number | undefined): React.ReactNode {
  if (val === undefined) {
    return <span className="italic text-muted-foreground">undefined value</span>;
  }
  return <span>{val}</span>;
}

/**
 * If diffMode === "none," we show everything grouped by numeric value
 * (like StringView "none" mode). We'll gather base + comparables => map<number | undefined, rowIndices>.
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

  // Use string keys to avoid issues with undefined as Map key
  const map = new Map<string, number[]>();
  allNums.forEach((n, i) => {
    const key = n === undefined ? "undefined" : String(n);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(allRows[i]);
  });
  
  // Convert to array: { numVal, rows }
  return Array.from(map.entries()).map(([key, rowArr]) => {
    const numVal = key === "undefined" ? undefined : Number(key);
    return {
      numVal,
      rows: rowArr.sort((a, b) => a - b),
    };
  });
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
function applySymbol(baseVal: number | undefined, compVal: number | undefined, symbol: string): number | undefined {
  // If either value is undefined, result is undefined
  if (baseVal === undefined || compVal === undefined) {
    return undefined;
  }
  
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
      return undefined;
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
}: LogComparisonProps) {
  // Single vs. multiple
  const singleMode = !comparables || comparables.length === 0;

  // Version strings
  const baseVer = version || "";
  const compVers = comparableVersions;
  const versionEmpty = !baseVer && compVers.every((s) => !s);

  // Always show base if single-mode
  const baseNum = asFiniteNumber(value);

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
              <div className="flex p-2 relative">
                <div>
                  <MarkdownRenderer>{baseVer}</MarkdownRenderer>
                </div>
                <CopyButton
                  className="absolute top-1 right-1 text-gray-400 hover:text-gray-700"
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
          <div className="flex border rounded p-2 relative">
            <div>
              <p className="text-sm">{displayValue(baseNum)}</p>
            </div>
            <CopyButton
              className="absolute top-1 right-1 text-gray-400 hover:text-gray-700"
              content={baseNum !== undefined ? String(baseNum) : "undefined"}
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
                      className="flex border rounded p-2 relative"
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
                <div className="border rounded p-2 bg-background relative">
                  <RowBadge rowNumbers={rowNums} mode="none" />
                  <CopyButton
                    className="absolute top-1 right-1 text-gray-400 hover:text-gray-700"
                    content={numVal !== undefined ? String(numVal) : "undefined"}
                    copyMessage="Copied number!"
                  />
                  <p className="text-sm mt-2">{displayValue(numVal)}</p>
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
  const map = new Map<string, number[]>();
  compNums.forEach((cn, i) => {
    const r = comparisonLogsIndex[i];
    const key = cn === undefined ? "undefined" : String(cn);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(r);
  });

  const compBlocks = Array.from(map.entries()).map(([key, rows]) => {
    const numVal = key === "undefined" ? undefined : Number(key);
    return {
      numVal,
      rows: rows.sort((a, b) => a - b),
    };
  });

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
                      className="p-3 border rounded relative"
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
                <div className="relative border rounded p-2 w-fit min-w-24 text-start">
                  <div className="flex-col items-start justify-between gap-5">
                    <RowBadge rowNumbers={[baseLogIndex]} mode="none" />
                    <p className="text-sm pt-5">{displayValue(baseNum)}</p>
                  </div>
                  <CopyButton
                    className="absolute top-1 right-1 text-gray-400 hover:text-gray-700"
                    content={baseNum !== undefined ? String(baseNum) : "undefined"}
                    copyMessage="Copied base!"
                  />
                </div>

                {/* Symbol */}
                <span className="text-xl font-bold">{currentSymbol}</span>

                {/* Comparable */}
                <div className="relative border rounded p-2 w-fit min-w-24 text-start">
                  <div className="flex-col items-start justify-between gap-5">
                    <RowBadge rowNumbers={rowNums} mode="none" />
                    <p className="text-sm pt-5">{displayValue(compVal)}</p>
                  </div>
                  <CopyButton
                    className="absolute top-1 right-1 text-gray-400 hover:text-gray-700"
                    content={compVal !== undefined ? String(compVal) : "undefined"}
                    copyMessage="Copied comp!"
                  />
                </div>

                <span className="mx-2 text-xl font-bold">=</span>

                {/* Result */}
                <div className="relative border rounded p-2 w-fit min-w-24 text-start bg-background">
                  <div className="flex-col items-start justify-between gap-5">
                    <p>Result</p>
                    {result !== undefined ? (
                      Number.isFinite(result) ? (
                        <p className="text-sm pt-5">{result}</p>
                      ) : (
                        <p className="text-sm pt-5">∞</p>
                      )
                    ) : (
                      <p className="text-sm pt-5 italic text-muted-foreground">undefined value</p>
                    )}
                  </div>
                  <CopyButton
                    className="absolute top-1 right-1 text-gray-400 hover:text-gray-700"
                    content={result !== undefined ? String(result) : "undefined"}
                    copyMessage="Copied result!"
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