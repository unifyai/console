"use client";

import React from "react"
import Tooltip from "@/components/Common/Misc/Tooltip"

/**
 * Compresses row indices like [1,2,3,5,6,8] to a string "1-3,5-6,8".
 * Adds 1 to each index to convert from 0-based (internal) to 1-based (display).
 */
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return "";
  // Add 1 to each row number to convert from 0-based to 1-based
  const sorted = [...rows].map(r => r + 1).sort((a, b) => a - b);

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

  return ranges.join(", ");
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
 *  - Renders "[3, 5-7, 9]" or "[2]" etc. with a color-coded background.
 *  - On hover, shows a tooltip according to "mode" and row count:
 *      - delete => "Only in row 3" or "Only in rows 1-2,4"
 *      - insert => "Changes in row 5" or "Changes in rows 2-3,6"
 *      - base   => "Base row 3" or "Base rows 2,4"  
 *      - none   => "Row 3" or "Rows 4,6-7"
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
  const count = rowNumbers.length;
  const rowOrRows = count === 1 ? "row" : "rows";

  // Decide color classes
  let colorClasses = customClass || "";
  if (!customClass) {
    switch (mode) {
      case "insert":
        colorClasses = "insert bg-green-300 text-green-800";
        break;
      case "delete":
        colorClasses = "delete bg-red-300 text-red-800";
        break;
      case "base":
        colorClasses = "base bg-red-200 text-red-800";
        break;
      default:
        // mode="none"
        colorClasses = "none bg-gray-200 text-gray-700";
        break;
    }
  }

  // Build tooltip text
  let hoverText = "";
  switch (mode) {
    case "delete":
      // "Only in row 3" or "Only in rows 3,5-7"
      hoverText = `Only in ${rowOrRows} ${label}`;
      break;
    case "insert":
      // "Changes in row 3" or "Changes in rows 3,5-7"
      hoverText = `Changes in ${rowOrRows} ${label}`;
      break;
    case "base":
      // "Base row 3" or "Base rows 3,5-7"
      if (count === 1) {
        hoverText = `Base row ${label}`;
      } else {
        hoverText = `Base rows ${label}`;
      }
      break;
    default:
      // mode="none" => "Row 3" or "Rows 3,5-7"
      if (count === 1) {
        hoverText = `Row ${label}`;
      } else {
        hoverText = `Rows ${label}`;
      }
      break;
  }

  return (
    <Tooltip content={hoverText}>
      <span
        className={`row-badge rounded text-xs px-1 py-0.5 font-semibold ${colorClasses}`}
      >
        [{label}]
      </span>
    </Tooltip>
  );
}
