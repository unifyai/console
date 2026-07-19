'use client';

import React from 'react';
import { LogComparisonProps } from './types';
import RowBadge from './RowBadge';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import MarkdownRenderer from './Markdown/MarkdownRenderer';
import { useEditablePrimitive } from '@/hooks/Interfaces/useEditablePrimitive';
import { showErrorToast } from '@/components/Common/Toasts/notifications';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { useAccordionDensity } from '@/components/UI/accordion';

/**
 * Convert unknown => finite number, or null if not a valid number.
 */
function asFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  // Ensure string numbers are parsed correctly
  if (typeof val === 'string') {
    const num = parseFloat(val);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  // Return null instead of NaN or Infinity for non-finite values
  return null;
}

// Helper Component for a single editable number field, group-aware
const EditableNumberField = ({
  initialValue,
  logIndices, // Pass all log indices for this group
  path,
  onGroupSave, // Use a group-aware save handler
  isImmutable,
}: {
  initialValue: number | null;
  logIndices: number[]; // Indices sharing this value
  path: (string | number)[];
  onGroupSave: (desc: { logIndices: number[]; path: (string | number)[]; newValue: any }) => void; // Handler accepts multiple indices
  isImmutable?: boolean;
}) => {
  const { draft, inputProps } = useEditablePrimitive<number | null>(
    initialValue,
    (newValue) => {
      const finalValue = typeof newValue === 'string' ? parseFloat(newValue) : newValue;
      // Ensure we only save valid numbers, pass null if parsing fails
      onGroupSave({ logIndices, path, newValue: Number.isFinite(finalValue) ? finalValue : null });
    },
    (val) =>
      typeof val === 'number' || val === null || !isNaN(parseFloat(String(val)))
        ? true
        : 'Invalid number' // Validate as number or allow null
  );

  // Handle potential string values coming from inputProps.value
  const displayValue = draft === null ? '' : String(draft);

  return isImmutable ? (
    <Tooltip content="Immutable field cannot be edited">
      <input
        className="text-body w-full rounded border p-1 font-mono"
        {...inputProps}
        value={displayValue}
        disabled
      />
    </Tooltip>
  ) : (
    <input
      type="number"
      step="any"
      className="text-body w-full rounded border bg-input p-1 font-mono text-foreground"
      {...inputProps}
      value={displayValue}
    />
  );
};

/**
 * If diffMode === "none," we show everything grouped by numeric value
 * (like StringView "none" mode). We'll gather base + comparables => map<number | null, rowIndices>.
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

  const map = new Map<number | null, number[]>();
  allNums.forEach((n, i) => {
    // Use n as-is (could be null)
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
    const verStr = r === baseLogIndex ? baseVer : (compVers[compLogIndexes.indexOf(r)] ?? '');
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
 * - For "−": result = baseVal − compVal
 * - For "+": result = compVal + baseVal
 * - For "×": result = compVal × baseVal
 * - For "÷": result = compVal / baseVal   (if baseVal=0 => Infinity)
 */
function applySymbol(baseVal: number, compVal: number, symbol: string): number {
  switch (symbol) {
    case '+':
      return compVal + baseVal;
    case '−':
      return baseVal - compVal;
    case '×':
      return compVal * baseVal;
    case '÷':
      return baseVal === 0 ? Infinity : compVal / baseVal;
    default:
      return 0;
  }
}

const symbols = ['−', '+', '×', '÷'] as const;

export default function NumberView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = 'none',
  splitView = false, // not used further, just included for parity
  version = '',
  comparableVersions = [],
  scientificNotation = false,
  displayMode = 'markdown',
  cellEditMode = false,
  onSaveEdit,
  onGroupSaveEdit,
  path = [],
  nested = false,
  isImmutable,
}: LogComparisonProps & { scientificNotation?: boolean; nested?: boolean; isImmutable?: boolean }) {
  // ------------------------------------------------------------------
  // Hooks must be called unconditionally. Declare state BEFORE any
  // potential early-return to keep hook order stable across renders.
  // ------------------------------------------------------------------
  const density = useAccordionDensity();
  const [opIndex, setOpIndex] = React.useState(0);
  const currentSymbol = symbols[opIndex];
  function handleCycleSymbol() {
    setOpIndex((prev) => (prev + 1) % symbols.length);
  }

  // Helper function to format numbers when scientificNotation is enabled
  function formatNumberVal(val: number | null): string {
    if (val === null) return '(invalid number)';
    if (scientificNotation && val !== 0 && Math.abs(val) < 0.01) {
      return val.toExponential(2);
    }
    // Ensure toString() is called on a valid number
    return val.toString();
  }

  const singleMode = !comparables || comparables.length === 0;

  // Compact LogGrid nest leaves: skip Interfaces bordered card chrome.
  if (density === 'compact' && nested && !cellEditMode) {
    if (singleMode) {
      return (
        <pre className="m-0 whitespace-pre-wrap break-words p-0 font-mono text-[11px] leading-snug text-foreground">
          {formatNumberVal(asFiniteNumber(value))}
        </pre>
      );
    }
    const groups = groupAllNumbersByValue(value, comparables, baseLogIndex, comparisonLogsIndex);
    return (
      <div className="space-y-0.5">
        {groups.map((group) =>
          group.numVal === null ? null : (
            <div key={group.rows.join(',')} className="flex min-w-0 items-start gap-1">
              <RowBadge rowNumbers={group.rows} mode="none" />
              <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words p-0 font-mono text-[11px] leading-snug text-foreground">
                {formatNumberVal(group.numVal)}
              </pre>
            </div>
          )
        )}
      </div>
    );
  }

  if (cellEditMode && (onSaveEdit || onGroupSaveEdit)) {
    // Group numbers by value
    const numberGroups = groupAllNumbersByValue(
      value,
      comparables,
      baseLogIndex,
      comparisonLogsIndex
    );

    // Define the handler that will be called by EditableNumberField's onSave
    const handleGroupSave = ({
      logIndices,
      path,
      newValue,
    }: {
      logIndices: number[];
      path: (string | number)[];
      newValue: any;
    }) => {
      if (onGroupSaveEdit) {
        // Call the group save handler directly with all indices
        onGroupSaveEdit({ logIndices, path, newValue });
      } else if (onSaveEdit && logIndices.length > 0) {
        // Fallback: Call single save for the first index if group save handler is not provided
        console.warn(
          'Using single onSaveEdit for grouped number field. Consider implementing onGroupSaveEdit.'
        );
        onSaveEdit({ logIndex: logIndices[0], path, newValue });
      }
    };

    return (
      <div className="space-y-3">
        {numberGroups.map((group, index) =>
          // Skip rendering for invalid number groups (null)
          group.numVal === null ? null : (
            <div key={index}>
              {/* Display RowBadges for the logs sharing this value */}
              {!nested && (
                <div className="mb-1 flex items-center gap-1">
                  <RowBadge rowNumbers={group.rows} mode="none" />
                  <span className="text-caption text-muted-foreground">
                    {group.rows.length > 1 ? `(${group.rows.length} logs)` : ''}
                  </span>
                </div>
              )}
              {/* Render a single editable field for this group */}
              <EditableNumberField
                initialValue={group.numVal} // Pass the numeric value
                logIndices={group.rows} // Pass the indices associated with this group
                path={path}
                onGroupSave={handleGroupSave} // Pass the group save handler
                isImmutable={isImmutable}
              />
            </div>
          )
        )}
      </div>
    );
  }

  // --- Read-only rendering logic ---
  const baseVer = version || '';
  const compVers = comparableVersions;
  const versionEmpty = !baseVer && compVers.every((s) => !s);
  const baseNum = asFiniteNumber(value);

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
              <div className="group relative flex rounded border p-2">
                <div>
                  <MarkdownRenderer>{baseVer}</MarkdownRenderer>
                </div>
                <CopyButton
                  className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  content={baseVer}
                  copyMessage="Copied version!"
                  tooltipContent="Copy version"
                />
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">No version</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {!versionEmpty && <p className="text-title">Value</p>}
          <div className="group relative flex rounded border p-2">
            <div>
              <p className="text-body">{formatNumberVal(baseNum)}</p>
            </div>
            {baseNum !== null && (
              <CopyButton
                className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                content={String(baseNum)}
                copyMessage="Copied number!"
                tooltipContent="Copy number"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  /////////////////////////////////////////////////////////////////////////
  // MULTI-MODE => We have baseNum + comparables
  /////////////////////////////////////////////////////////////////////////

  // If diffMode === "none," group them ignoring base vs. comps (like stringView).
  if (diffMode === 'none') {
    const groups = groupAllNumbersByValue(value, comparables, baseLogIndex, comparisonLogsIndex);

    // Filter out groups where all values are null (invalid numbers)
    const filteredGroups = groups.filter((group) => group.numVal !== null);

    return (
      <div className="space-y-4">
        {filteredGroups.map((grp, i) => {
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
            <div key={i} className="space-y-4 p-3">
              {!versionEmpty && (
                <div className="space-y-2">
                  <p className="text-title">Version</p>
                  {verGroups.map((vg, j) => (
                    <div key={j} className="group relative flex rounded border p-2">
                      <RowBadge rowNumbers={vg.rows} mode="none" />
                      {vg.text ? (
                        <div className="pt-2">
                          <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="text-body italic text-muted-foreground">No version</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {!versionEmpty && <p className="text-title">Value</p>}
                <div className="group relative rounded border bg-background p-2">
                  <RowBadge rowNumbers={rowNums} mode="none" />
                  {numVal !== null && (
                    <CopyButton
                      className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      content={String(numVal)}
                      copyMessage="Copied number!"
                    />
                  )}
                  <p className="text-body mt-2">{formatNumberVal(numVal)}</p>
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
  const map = new Map<number | null, number[]>();
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
        <p className="text-title">Operation:</p>
        <button
          className="text-body rounded border px-2 py-1 hover:bg-muted"
          onClick={handleCycleSymbol}
        >
          {currentSymbol}
        </button>
      </div>

      {compBlocks.map((block, i) => {
        const compVal = block.numVal;
        const rowNums = block.rows;

        // Skip invalid number comparison blocks entirely
        if (compVal === null) {
          return null;
        }

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
        // Only calculate if both values are valid
        const result =
          baseNum !== null && compVal !== null
            ? applySymbol(baseNum, compVal, currentSymbol)
            : null;

        return (
          <div key={i} className="space-y-4 rounded border p-3">
            {/* Show param versions if not empty */}
            {!versionEmpty && (
              <div className="space-y-2">
                <p className="text-title">Param Version</p>
                {versionGroups.map((vg, j) => {
                  return (
                    <div key={j} className="group relative rounded border p-3">
                      <RowBadge rowNumbers={vg.rows} mode="none" />
                      {vg.text ? (
                        <div className="pt-2">
                          <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="text-body italic text-muted-foreground">No version</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-4">
                {/* Base */}
                <div className="group relative w-fit min-w-24 rounded border p-2 text-start">
                  <div className="flex-col items-start justify-between gap-5">
                    {baseNum !== null && (
                      <CopyButton
                        className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        content={String(baseNum)}
                        copyMessage="Copied base!"
                      />
                    )}
                    <RowBadge rowNumbers={[baseLogIndex]} mode="none" />
                    <p className="text-body pt-2">{formatNumberVal(baseNum)}</p>
                  </div>
                </div>

                {/* Symbol */}
                <span className="text-strong text-xl">{currentSymbol}</span>

                {/* Comparable */}
                <div className="group relative w-fit min-w-24 rounded border p-2 text-start">
                  <div className="flex-col items-start justify-between gap-5">
                    {compVal !== null && (
                      <CopyButton
                        className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        content={String(compVal)}
                        copyMessage="Copied comp!"
                      />
                    )}
                    <RowBadge rowNumbers={rowNums} mode="none" />
                    <p className="text-body pt-2">{formatNumberVal(compVal)}</p>
                  </div>
                </div>

                <span className="text-strong mx-2 text-xl">=</span>

                {/* Result */}
                <div className="group relative w-fit min-w-24 rounded border bg-background p-2 text-start">
                  <div className="flex flex-col">
                    {result !== null && (
                      <CopyButton
                        className="absolute right-1 top-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        content={String(result)}
                        copyMessage="Copied result!"
                      />
                    )}
                    <p className="text-title">Result</p>
                    <p className="text-body mt-2">
                      {result === null
                        ? '(cannot calculate)'
                        : Number.isFinite(result)
                          ? formatNumberVal(result)
                          : '∞'}
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
