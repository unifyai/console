'use client';

import React from 'react';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { useTheme } from 'next-themes';

/**
 * Compresses row indices like [0,1,2,4,5,7] to a string "1-3,5-6,8".
 *
 * IMPORTANT: This function ALWAYS assumes the input indices are 0-based
 * (internal representation) and ALWAYS adds 1 to convert to 1-based (UI display).
 *
 * @param rows Array of 0-based row indices
 * @returns Formatted string of 1-based row numbers for display
 */
function compressRowNumbers(rows: number[]): string {
  if (!rows.length) return '';

  if (!rows.length) return '';

  // ALWAYS convert from 0-based to 1-based for display
  const sorted = [...rows].map((r) => r + 1).sort((a, b) => a - b);

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

  return ranges.join(', ');
}

export interface RowBadgeProps {
  /**
   * Array of 0-based row indices
   * These are indices into the logs array, NOT UI row numbers
   */
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
  mode?: 'insert' | 'delete' | 'base' | 'none';
}

/**
 * RowBadge:
 *  - Renders "[3, 5-7, 9]" or "[2]" etc. with a color-coded background.
 *  - On hover, shows a tooltip according to "mode" and row count.
 *  - IMPORTANT: Expects 0-based indices as input and converts to 1-based for display.
 */
export default function RowBadge({
  rowNumbers,
  isBase = false,
  customClass,
  mode = 'none',
}: RowBadgeProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDarkMode = theme === 'dark' || resolvedTheme === 'dark';

  if (!rowNumbers.length) {
    return null;
  }

  const label = compressRowNumbers(rowNumbers);
  const count = rowNumbers.length;
  const rowOrRows = count === 1 ? 'row' : 'rows';

  // Decide color classes
  let colorClasses = customClass || '';
  if (!customClass) {
    switch (mode) {
      case 'insert':
        colorClasses = isDarkMode
          ? 'insert border border-muted bg-[color:var(--status-success)] text-primary-foreground'
          : 'insert border border-muted bg-[color:var(--status-success-bg)] text-foreground';
        break;
      case 'delete':
        colorClasses = isDarkMode
          ? 'delete border border-muted bg-[color:var(--status-danger)] text-destructive-foreground'
          : 'delete border border-muted bg-[color:var(--status-danger-bg)] text-foreground';
        break;
      case 'base':
        colorClasses = isDarkMode
          ? 'base border border-muted bg-[color:var(--status-danger)] text-destructive-foreground'
          : 'base border border-muted bg-[color:var(--status-danger-bg)] text-foreground';
        break;
      default:
        // mode="none"
        colorClasses = isDarkMode
          ? 'none bg-background text-foreground border border-muted'
          : 'none bg-background text-foreground border border-muted';
        break;
    }
  }

  // Build tooltip text
  let hoverText = '';
  switch (mode) {
    case 'delete':
      // "Not in row 3" or "Not in rows 3,5-7"
      hoverText = `Not in ${rowOrRows} ${label}`;
      break;
    case 'insert':
      // "Only in row 3" or "Only in rows 3,5-7"
      hoverText = `Only in ${rowOrRows} ${label}`;
      break;
    case 'base':
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
      <span className={`row-badge text-caption text-strong rounded px-1 py-0.5 ${colorClasses}`}>
        [{label}]
      </span>
    </Tooltip>
  );
}
