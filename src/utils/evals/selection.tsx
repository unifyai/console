"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Span } from "@/types/evals/traces"
import { LogProps } from "@/types/evals/logs"
import { sanitizeId } from "./columnOperations"
import Image from "next/image"

const signedUrlCache = new Map<string, string>();
const signedUrlInProgress = new Set<string>();

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

// Add a debounce utility to prevent too many simultaneous requests
const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

export const ImageDisplay = ({ value, className }: { value: string; className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Separate immediate fetch function for initial load
  const fetchSignedUrl = async (imageUrl: string) => {
    try {
      const parsedUrl = new URL(imageUrl);
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      const bucket = pathParts[0];
      const path = pathParts.slice(1).join("/");
      
      const currentUrl = signedUrlCache.get(imageUrl);
      const queryParams = new URLSearchParams({
        bucket: bucket,
        path: path,
        ...(currentUrl ? { url: currentUrl } : {})
      });
      
      const res = await fetch(`/api/image/get?${queryParams}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch signed URL: ${res.statusText}`);
      }
      
      const newUrlData = await res.json();
      signedUrlCache.set(parsedUrl.href, newUrlData.url);
      signedUrlInProgress.delete(parsedUrl.href);
      setUrl(newUrlData.url);
    } catch (err) {
      console.error("Error fetching signed URL:", err);
      signedUrlInProgress.delete(imageUrl);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced version only for error recovery
  const debouncedFetchSignedUrl = useMemo(
    () => debounce((imageUrl: string) => fetchSignedUrl(imageUrl), 300),
    []
  );

  useEffect(() => {
    const initializeImage = async () => {
      try {
        // If the value is already a data URI, use it immediately
        if (value.startsWith("data:image/")) {
          setUrl(value);
          setLoading(false);
          return;
        }

        const isBase64 = isBase64Image(value);
        let imageUrl = isBase64 ? `data:image/png;base64,${value}` : value;

        try {
          const parsedUrl = new URL(imageUrl);

          // Only proceed with GCS URLs that aren't already signed
          if (parsedUrl.hostname === "storage.googleapis.com") {
            // Check cache first
            const cachedUrl = signedUrlCache.get(imageUrl);
            if (cachedUrl) {
              setUrl(cachedUrl);
              setLoading(false);
              return;
            }

            // If fetch is already in progress, wait for it
            if (signedUrlInProgress.has(imageUrl)) {
              const checkInterval = setInterval(() => {
                const cachedResult = signedUrlCache.get(imageUrl);
                if (cachedResult) {
                  setUrl(cachedResult);
                  setLoading(false);
                  clearInterval(checkInterval);
                }
              }, 100);
              return;
            }

            signedUrlInProgress.add(imageUrl);
            // Use immediate fetch for initial load
            await fetchSignedUrl(imageUrl);
          } else {
            setUrl(imageUrl);
            setLoading(false);
          }
        } catch (parseError) {
          console.error("Error parsing or converting URL:", parseError);
          signedUrlInProgress.delete(imageUrl);
          throw parseError;
        }
      } catch (err: any) {
        console.error("Error in ImageDisplay initialization:", err);
        setError(err);
        setLoading(false);
      }
    };

    initializeImage();
  }, [value]);

  // Use debounced fetch only for error recovery
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    if (img.src && img.src.includes('storage.googleapis.com')) {
      const originalUrl = value;
      signedUrlCache.delete(originalUrl);
      setLoading(true);
      setError(null);
      // Use debounced fetch for error recovery
      debouncedFetchSignedUrl(originalUrl);
    }
  }, [value, debouncedFetchSignedUrl]);

  if (loading) {
    return <span>Loading image...</span>;
  }

  if (error || !url) {
    console.error("[ImageDisplay] Rendering error state:", error);
    return <span>Error loading image</span>;
  }

  // Render based on whether it's a base64 image or a clickable URL image
  const isBase64 = isBase64Image(value);
  console.log("[ImageDisplay] Rendering final component. isBase64:", isBase64);
  if (isBase64) {
    return (
      <Image
        src={url}
        alt="Base64 image"
        width={500}
        height={500}
        className={className}
        onError={handleImageError}
      />
    );
  } else {
    return (
        <Image
          src={url}
          alt="Image link"
          width={500}
          height={500}
          className={className}
          onError={handleImageError}
        />
    );
  }
};

export const isDict = (value: any) => typeof value === "object" && !Array.isArray(value) && !(value instanceof RegExp) && !(value instanceof Date) && !(value instanceof Function) && value != null;
export const isList = (value: any) => Array.isArray(value);
export const isMatrix = (value: any) => isList(value) && value.every(row => Array.isArray(row) && row.every(number => typeof number === "number"));

export function isURLImage(value: string): boolean {
  try {
    const url = new URL(value);
    
    // Automatically return true for Google Cloud Storage URLs
    if (url.hostname === 'storage.googleapis.com') {
      return true;
    }

    // Check for typical image file extensions
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp'];
    const hasImageExtension = imageTypes.some(type => url.pathname.toLowerCase().includes(type));
    
    return hasImageExtension;
  } catch (e) {
    return false;
  }
}

export const isBase64Image = (value: string) => {
  try {
    /*
     * If the string starts with "data:image" then parse out the actual base64 portion.
     * Otherwise, assume it's raw base64 (no prefix).
     */
    let raw64 = value;
    // If it has "data:image/xxxx;base64," then parse out just the raw base64
    const match = raw64.match(/^data:image\/\w+;base64,(.*)$/);
    if (match) {
      raw64 = match[1]; // store only the base64 part
    }

    const decoded = atob(raw64);

    // Check PNG (header = 0x89 0x50 0x4e 0x47) or JPEG (header = 0xff 0xd8 0xff)
    return decoded.includes('\x89\x50\x4E\x47') || decoded.includes('\xFF\xD8\xFF');
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
 * Returns true if the value is either a single Span or a non-empty array of Spans,
 * and false otherwise.
 */
export function isTrace(x: any): x is Span | Span[] {
  if (!x) return false;
  // If it's just one Span
  if (isSpan(x)) return true;
  // If it's a non-empty array of spans
  if (Array.isArray(x) && x.length > 0 && x.every(item => isSpan(item))) {
    return true;
  }
  return false;
}

/** Minimal isNumber check. */
export function isNumber(value: any): boolean {
  return typeof value === "number";
}

export function isTimestamp(value: any): boolean {
  if (typeof value !== "string") return false;
  // Rough ISO-8601 pattern (YYYY-MM-DDTHH:mm:ss, optionally with milliseconds & zone)
  const isoRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.\d+)?(Z|[+\-][0-9]{2}:[0-9]{2})?$/;
  return isoRegex.test(value);
}

/** Minimal isChat check:
 *  e.g. require an object with an "id" and a "choices" array.
 */
export function isChat(value: any): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  // Basic check for chat-like structure
  const hasMessages = 'messages' in value && Array.isArray(value.messages);
  const hasRole = hasMessages && value.messages.every((m: any) => 'role' in m && typeof m.role === 'string');
  const hasContent = hasMessages && value.messages.every((m: any) => 'content' in m && typeof m.content === 'string');

  return hasMessages && hasRole && hasContent;
}

/**
 * Check if a value is a PDF link/path.
 * Detects strings ending with .pdf, with optional query parameters
 */
export function isPdf(value: any): boolean {
  if (typeof value !== 'string') return false;
  const pdfRegex = /\.pdf(\?.*)?$/i;  // matches "myfile.pdf?version=123" and .PDF
  return pdfRegex.test(value.trim());
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
  const baseLogParam = selectedCells.at(0)
  const baseLogParamId = baseLogParam?.split("_").at(0)
  const baseLogIndex = logs.findIndex((log) => log.id == baseLogParamId) + 1;
  let baseLog = logs.find((log) => log.id == baseLogParamId);
  if (baseLog)  {
    let columnIds = selectedCells
      .filter(id => id.split("_").at(0) === baseLogParamId)
      .map(cell => getPartAfterFirstUnderscore(cell))
    columnIds = Array.from(new Set(columnIds.map(sanitizeId)))
    baseLog = {...baseLog, entries: getDictSubset(baseLog.entries, columnIds)}
    if (baseLog.params)
      baseLog.params = getDictSubset(baseLog.params, columnIds)
  }
  else
    selectedCells = [];

  // Fix for case where on row is selected
  const uniqueLogIds = Array.from(new Set(selectedCells.map(cell => cell.split("_")[0])));

  // If there's only one unique log ID, there should be no comparison logs
  if (uniqueLogIds.length === 1) {
    return { baseLogIndex, baseLog, comparisonLogsIndex: [], comparisonLogs: [] };
  }

  // Locate comparison logs and their row indices in the table, then filter values for selected cells that pertain to each log
  const comparisonLogsParam = selectedCells.slice(1)
  let comparisonLogsIndex = comparisonLogsParam 
    ? comparisonLogsParam.map((cl) => logs.findIndex((log) => log.id == cl.split("_").at(0)) + 1) 
    : [];
  comparisonLogsIndex = Array.from(new Set(comparisonLogsIndex))
  let comparisonLogs = comparisonLogsParam && logs
    ? comparisonLogsParam.map((cl: string) => logs.find((log) => log.id == cl.split("_").at(0))!)
    : [];
  comparisonLogs = Array.from(new Set(comparisonLogs))
  if (comparisonLogs.length) {
    comparisonLogs = comparisonLogs.map((cl, index) => {
      const clParam = comparisonLogsParam![index]
      const clParamId = clParam.split("_").at(0)
      let columnIds = selectedCells
        .filter(id => id.split("_").at(0) === clParamId)
        .map(cell => getPartAfterFirstUnderscore(cell))
      columnIds = Array.from(new Set(columnIds.map(sanitizeId)))
      const comparisonLog = {...cl, entries: getDictSubset(cl.entries, columnIds)}
      if (cl.params)
        comparisonLog.params = getDictSubset(cl.params, columnIds)
      return comparisonLog
    })
  }

  return { baseLogIndex, baseLog, comparisonLogsIndex, comparisonLogs }
};