import React from "react";

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

interface RowBadgeProps {
  rowNumbers: number[];
  isBase?: boolean;
  customClass?: string;
}

/**
 * RowBadge:
 *  - Takes an array of rowNumbers (e.g., [1,2,3]) and compresses into "1-3"
 *  - If customClass is provided, that will override text color classes
 *  - Otherwise, if isBase is true => red background, else green background
 */
export default function RowBadge({
  rowNumbers,
  isBase = false,
  customClass,  
}: RowBadgeProps) {
  if (!rowNumbers.length) return null;

  const label = compressRowNumbers(rowNumbers);

  // If a custom class is provided, use that for color;
  // otherwise, fallback to old base/comparison logic with background color.
  const colorClasses = customClass
    ? customClass
    : isBase
      ? "bg-red-300 text-red-800"
      : "bg-green-300 text-green-800";

  return (
    <span className={`px-1 ml-1 rounded text-xs font-semibold ${colorClasses}`}>
      [{label}]
    </span>
  );
}
