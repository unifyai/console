"use client";

import React from "react"
import Tooltip from "@/components/Common/Misc/Tooltip"

/**
 * compressRowNumbers:
 * Compresses an array of row indices (like [1,2,3,5,6,8])
 * to a string like "1-3,5-6,8".
 */
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
    } else {
      if (start === end) {
        ranges.push(String(start));
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = current;
      end = current;
    }
  }
  if (start === end) {
    ranges.push(String(start));
  } else {
    ranges.push(`${start}-${end}`);
  }

  return ranges.join(",");
}

export interface RowBadgeProps {
  rowNumbers: number[];
  /**
   * If true, it's interpreted as base rows. This can be superseded by "mode".
   */
  isBase?: boolean;
  /**
   * A custom class for styling (background color, text color, etc.).
   * If provided, it overrides the default mode/badge logic.
   */
  customClass?: string;
  /**
   * The "mode" for this badge: "insert" | "delete" | "base" | "none"
   * Used to show different color classes and a specific hover tooltip.
   */
  mode?: "insert" | "delete" | "base" | "none";
}

/**
 * RowBadge:
 *  - Takes an array of rowNumbers (e.g. [1,2,3]) and compresses them ("1-3").
 *  - Renders a small badge "[1-3]" with a color. 
 *  - On hover, a shadcn-based tooltip shows e.g. "Inserted Rows: 1-3".
 */
export default function RowBadge({
  rowNumbers,
  isBase = false,
  customClass,  
  mode = "none",
}: RowBadgeProps) {
  if (!rowNumbers.length) {
    return null;
  }

  const label = compressRowNumbers(rowNumbers);

  // Decide color classes
  let colorClasses = customClass || "";
  if (!customClass) {
    if (mode === "insert") {
      colorClasses = "insert bg-green-300 text-green-800";
    } else if (mode === "delete") {
      colorClasses = "delete bg-red-300 text-red-800";
    } else if (mode === "base" || isBase) {
      colorClasses = "base bg-red-200 text-red-800";
    } else {
      // mode === "none"
      colorClasses = "none bg-gray-200 text-gray-700";
    }
  }

  // Build the tooltip text
  let hoverText = "";
  switch (mode) {
    case "insert":
      hoverText = `Inserted To Row(s) ${label}`;
      break;
    case "delete":
      hoverText = `Deleted From Row(s) ${label}`;
      break;
    case "base":
      hoverText = `Base Row(s) ${label}`;
      break;
    case "none":
      hoverText = `No Changes to Row(s) ${label}`;
    default:
      // if isBase is set, we can interpret that as base
      if (isBase) {
        hoverText = `Base Rows ${label}`;
      } else {
        hoverText = `No Changes Rows ${label}`;
      }
      break;
  }

  return (
    <Tooltip content={hoverText}>
      <span className={`row-badge px-1 ml-1 rounded text-xs font-semibold ${colorClasses}`}>
        [{label}]
      </span>
    </Tooltip>
  );
}