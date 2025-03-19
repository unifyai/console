import { LogProps } from "@/types/evals/logs";
import { sanitizeId } from "@/utils/evals/columnOperations";

/*******************************************************************************
 * Helper & Utility Functions
 ******************************************************************************/

/** Data shape checks from both old & new code. */
export function isDict(val: any): boolean {
    return val && typeof val === "object" && !Array.isArray(val);
  }
export function isList(val: any): boolean {
    return Array.isArray(val);
  }
export function isMatrix(val: any): boolean {
    return isList(val) && val.length > 0 && Array.isArray(val[0]);
  }
export function isImage(val: any): boolean {
    return typeof val === "string" && val.startsWith("data:image/");
  }
/**
 * Check if a value is a PDF link/path.
 * Detects strings ending with .pdf, with optional query parameters
 */
export function isPdf(val: any): boolean {
  if (typeof val !== 'string') return false;
  const pdfRegex = /\.pdf(\?.*)?$/i;  // matches "myfile.pdf?version=123" and .PDF
  return pdfRegex.test(val.trim());
}
export function isTrace(val: any): boolean {
// originally always false in old code
  return false;
}
export function isNumber(val: any): boolean {
  return typeof val === "number" || val instanceof Number;
}

/** Possibly used for param expansions from the old code. */
export function unwrapSingleKeyObject(val: unknown) {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const keys = Object.keys(val);
    if (keys.length === 1 && keys[0] === "0") {
    return (val as Record<string, unknown>)["0"];
    }
}
return val;
}

/** For row labeling in combobox, etc. */
export function rowLabel(rowIndex: number) {
  return `Row ${rowIndex + 1}`;
}

/** Shallow compare for array of strings. */
export function shallowArrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
    return false;
    }
}
return true;
}

/** Shallow compare for boolean record objects. */
export function shallowEqualBooleanRecords(
a: Record<string, boolean>,
b: Record<string, boolean>
): boolean {
const aKeys = Object.keys(a);
const bKeys = Object.keys(b);
if (aKeys.length !== bKeys.length) {
    return false;
}
for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
}
return true;
}

/**
 * Parse the selection string into a map:
 *   rowIndex => Set of column names selected
 */
export function buildIndexToColumnsMapFromId(
selectedCells: string[],
sortedLogs: LogProps[]
): Record<number, Set<string>> {
  
  const map: Record<number, Set<string>> = {};
  for (const token of selectedCells) {    
    const underscorePos = token.indexOf("_");
    if (underscorePos < 1) {
      continue;
    }
    
    const logIdStr = token.slice(0, underscorePos);
    let columnName = token.slice(underscorePos + 1);
    
    const rowIndex = sortedLogs.findIndex((log) => String(log.id) === logIdStr);
    
    if (rowIndex < 0) {
      continue;
    }

    if (!map[rowIndex]) {
      map[rowIndex] = new Set<string>();
    }
    
    map[rowIndex].add(columnName);
  }
  return map;
}

/** Build row selection order from the selected cells. */
export function buildRowIndicesInSelectionOrder(
selectedCells: string[],
sortedLogs: LogProps[]
): number[] {
const seen = new Set<number>();
const rowIndices: number[] = [];
for (const token of selectedCells) {
    const underscorePos = token.indexOf("_");
    if (underscorePos < 1) continue;
    const logIdStr = token.slice(0, underscorePos);
    const rowIndex = sortedLogs.findIndex((log) => String(log.id) === logIdStr);
    if (rowIndex < 0) continue;
    if (!seen.has(rowIndex)) {
    seen.add(rowIndex);
    rowIndices.push(rowIndex);
    }
}
return rowIndices;
}

/*******************************************************************************
 * buildLogWithChosenColumns
 *   From original code, merges param expansions and hidden/ordered columns.
 ******************************************************************************/
export function buildLogWithChosenColumns(
originalLog: LogProps,
rowIndex: number,
globalParams: Record<string, unknown>,
indexToColumns: Record<number, Set<string>>,
columnOrdering: string[],
): LogProps {
const chosen = indexToColumns[rowIndex] ?? new Set<string>();

const safeEntries = originalLog.entries ?? {};

// The key fix: If none of the columnOrdering items match the chosen columns,
// fall back to using all chosen columns directly (even if columnOrdering.length > 0)
let finalColsEntries: string[];
if (columnOrdering.length > 0) {
    const filtered = columnOrdering.filter(c => chosen.has(c)).map(sanitizeId);
    if (filtered.length > 0) {
        finalColsEntries = filtered;
    } else {
        // If nothing matched, use the chosen columns directly
        finalColsEntries = Array.from(chosen).map(sanitizeId);
    }
} else {
    finalColsEntries = Array.from(chosen).map(sanitizeId);
}

const newEntries: Record<string, unknown> = {};
for (const c of finalColsEntries) {
    if (Object.prototype.hasOwnProperty.call(safeEntries, c)) {
    newEntries[c] = safeEntries[c];
    } else {
    }
}

const safeParams = originalLog.params ?? {};  

// Apply the same fix for params
let finalColsParams: string[];
if (columnOrdering.length > 0) {
    const filtered = columnOrdering.filter(c => chosen.has(c)).map(sanitizeId);
    if (filtered.length > 0) {
        finalColsParams = filtered;
    } else {
        // If nothing matched, use the chosen columns directly
        finalColsParams = Array.from(chosen).map(sanitizeId);
    }
} else {
    finalColsParams = Array.from(chosen).map(sanitizeId);
}

const newParams: Record<string, unknown> = {};
for (const c of finalColsParams) {
    if (!Object.prototype.hasOwnProperty.call(safeParams, c)) {
    continue;
    }
    const storedVal = safeParams[c];
    
    if (typeof storedVal === "string" && globalParams.hasOwnProperty(c)) {
    const candidateObj = globalParams[c];
    if (candidateObj && typeof candidateObj === "object") {
        if ((candidateObj as Record<string, unknown>).hasOwnProperty(storedVal)) {
        newParams[c] = {
            paramValue: (candidateObj as Record<string, unknown>)[storedVal],
            paramVersion: unwrapSingleKeyObject(storedVal),
        };
        continue;
        }
    }
    }
    newParams[c] = unwrapSingleKeyObject(storedVal);
}

return {
    ...originalLog,
    entries: newEntries,
    params: newParams,
};
}