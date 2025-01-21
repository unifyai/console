import React from "react"
import { Span } from "@/types/evals/traces"
import { LogProps } from "@/types/evals/logs"
import { sanitizeId } from "./columnOperations"

export const MatrixDisplay = ({value}:{value: number[][]}) => {
    return (
    <p className="font-normal whitespace-pre-wrap px-3">
        <code className="font-mono">
          {value.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {row.map((number, numberIndex) => (
                <React.Fragment key={numberIndex}>
                  {number.toString().padStart(2, ' ')}{numberIndex < row.length - 1 ? ', ' : ''}
                </React.Fragment>
              ))}
              {rowIndex < value.length - 1 ? '\n' : ''}
            </React.Fragment>
          ))}
        </code>
    </p>
    )
}

export const ImageDisplay = ({value, className}: {value: string, className?: string}) => {
  const url = isBase64Image(value) ? `data:image/png;base64,${value}` : value;
  return <img src={url} className={className}/>;
}

export const isDict = (value: any) => typeof value === "object" && !Array.isArray(value) && !(value instanceof RegExp) && !(value instanceof Date) && !(value instanceof Function) && value != null;
export const isList = (value: any) => Array.isArray(value);
export const isMatrix = (value: any) => isList(value) && value.every(row => Array.isArray(row) && row.every(number => typeof number === "number"));

export const isURLImage = (value: string) => {
  /* Check if URL image string 
     Example value: "https://oaidalleapiprodscus.blob.core.windows.net/private/org-D1OIs5ffDVTBSBpNWJyXxFfN/user-vlZW2XKHDiNPzwT4Xv6wlzgv/img-9mgiKpSrAV1p1iqZ9C0Nw2iq.png?st=2024-11-20T11%3A18%3A20Z&se=2024-11-20T13%3A18%3A20Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=d505667d-d6c1-4a0a-bac7-5c84a87759f8&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2024-11-20T00%3A40%3A43Z&ske=2024-11-21T00%3A40%3A43Z&sks=b&skv=2024-08-04&sig=9aNFotmijRyhe8JwkzMGX5WZWGxLIPSSXx6nigR02Y4%3D"
  */
  try {
    const url = new URL(value);
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp'];
    if (imageTypes.map(imageType => url.pathname.includes(imageType)).some(check => check)) return true;
  } catch (e) {
    return false
  }
}
export const isBase64Image = (value: string) => {
  /* Check if it's a Base64 image 
     Example value: "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAA552NhQlgAADnnanVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAOcFqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3Vybjp1dWlkOjE1ZDQ0YjJlLTUxMGUtNGUyMC1iMWJiLTJhNDA2NTMyOWFlMAAAAAGhanVtYgAAAClqdW1kYzJhcwARABCAAACqADibcQNjMnBhLmFzc2VydGlvbnMAAAAAxWp1bWIAAAAmanVtZGNib3IAEQAQgAAAqgA4m3EDYzJwYS5hY3Rpb25zAAAAAJdjYm9yoWdhY3Rpb25zgaNmYWN0aW9ubGMycGEuY3JlYXRlZG1zb2Z0d2FyZUFnZW50Z0RBTEzCt0VxZGlnaXRhbFNvdXJjZVR5cGV4Rmh0dHA6Ly9jdi5pcHRjLm9yZy9uZXdzY29kZXMvZGlnaXRhbHNvdXJ...."
  */
  try {
    const decoded = atob(value);
    return decoded.includes('\x89\x50\x4E\x47') || decoded.includes('\xFF\xD8\xFF'); // Checks for PNG and JPEG headers
  } catch (e) {
    return false;
  }
}
export const isImage = (value: any) => {
  if (typeof value !== "string") return false;
  return isBase64Image(value) || isURLImage(value);
}

/**
 * Quick type‐guard to see if an unknown object looks like a Span.
 * Returns true if the shape seems correct.
 */
export function isSpan(obj: any): obj is Span {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    typeof obj.span_name === "string" &&
    (obj.child_spans === undefined || Array.isArray(obj.child_spans))
  );
}

/**
 * Checks if a value is a single Span or an array of Spans (i.e., a trace).
 * Returns true if the value is either a single Span or an array of Spans,
 * and false otherwise.
 */
export function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  // If it's just one Span
  if (isSpan(x)) return true;
  // If it's an array of spans
  if (Array.isArray(x) && x.every(item => isSpan(item))) {
    return true;
  }
  return false;
}

/**
  * Given a list of keys, returns the subset of a dictionary 
  * for which the keys are included in the list
*/
export function getDictSubset(obj: any, keys: string[]) {
  return Object.keys(obj)
  .filter(key => keys.includes(key))
  .reduce((acc: any, key: string) => {
    acc[key] = obj[key];
    return acc;
  }, {});
}

/**
  * Given a string with multiple underscores, returns the full part that follows the first underscore
*/
export function getPartAfterFirstUnderscore (str: string) {
  return str.split("_").slice(1).join("_");
}

/**
  * Assuming an array of selected cells of the format logId_columnId:
  * - Sets the base log as the log corresponding to the first cell, based on the logId
  * - Sets comparison logs as the logs corresponding to the remaining cells, based on the logId
  * - Reduces the base and comparison logs values down to the values in the selected cells corresponding to each log
  * - Returns the base log with its index in the table, and the comparison logs with their indices
*/
export function extractBaseAndComparisonLogs (selectedCells: string[], logs:LogProps[]) {

  // Locate base log and its row index in the table, then filter values for selected cells that pertain to the base log
  const baseLogParam = selectedCells.at(0)                                      // logId1_columnId1
  const baseLogParamId = baseLogParam?.split("_").at(0)                         // logId1
  const baseLogIndex = logs.findIndex((log) => log.id == baseLogParamId) + 1;
  let baseLog = logs.find((log) => log.id == baseLogParamId);
  if (baseLog)  {
    let columnIds = selectedCells
      .filter(id => id.split("_").at(0) === baseLogParamId)                     // Find all selected cells from base
      .map(cell => getPartAfterFirstUnderscore(cell))                           // Handle underscores in column id
    columnIds = Array.from(new Set(columnIds.map(sanitizeId)))                          // Handle duplication in column id
    baseLog = {...baseLog, entries: getDictSubset(baseLog.entries, columnIds)}
    if (baseLog.params)
      baseLog.params = getDictSubset(baseLog.params, columnIds)

  }

  // Fix for case where on row is selected
  const uniqueLogIds = Array.from(new Set(selectedCells.map(cell => cell.split("_")[0])));
  
  // If there's only one unique log ID, there should be no comparison logs
  if (uniqueLogIds.length === 1) {
    return { baseLogIndex, baseLog, comparisonLogsIndex: [], comparisonLogs: [] };
  }

  // Locate comparison logs and their row indices in the table, then filter values for selected cells that pertain to each log
  const comparisonLogsParam = selectedCells.slice(1)                                // [logId1_colId2, logId2_colId3, ...]
  let comparisonLogsIndex = comparisonLogsParam 
    ? comparisonLogsParam.map((cl) => logs.findIndex((log) => log.id == cl.split("_").at(0)) + 1) 
    : [];
  comparisonLogsIndex = Array.from(new Set(comparisonLogsIndex))                    // Handle index duplication
  let comparisonLogs = comparisonLogsParam && logs
    ? comparisonLogsParam.map((cl: string) => logs.find((log) => log.id == cl.split("_").at(0))!)
    : [];
  comparisonLogs = Array.from(new Set(comparisonLogs))                              // Handle duplication in comparison logs
  if (comparisonLogs.length) {
    comparisonLogs = comparisonLogs.map((cl, index) => {
      const clParam = comparisonLogsParam![index]
      const clParamId = clParam.split("_").at(0)
      let columnIds = selectedCells
        .filter(id => id.split("_").at(0) === clParamId)                            // Find all selected cells from comparison
        .map(cell => getPartAfterFirstUnderscore(cell))                             // Handle underscores in column id
        columnIds = Array.from(new Set(columnIds.map(sanitizeId)))                                  // Handle duplication in column id
      const comparisonLog = {...cl, entries: getDictSubset(cl.entries, columnIds)}    
      if (cl.params)
        comparisonLog.params = getDictSubset(cl.params, columnIds)
      return comparisonLog
    })
  }

  return { baseLogIndex, baseLog, comparisonLogsIndex, comparisonLogs }
};