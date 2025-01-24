"use client";
import React from "react";
import { ImageDisplay } from "@/utils/evals/selection";
import { LogComparisonProps } from "./types";

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

/**
 * groupImagesByValue:
 * Combine base + comparables into arrays of { src, rows: number[] } for each unique image string.
 */
function groupImagesByValue(images: string[], rowIndexes: number[]) {
  const map = new Map<string, number[]>();
  images.forEach((img, i) => {
    const row = rowIndexes[i];
    if (!map.has(img)) {
      map.set(img, []);
    }
    map.get(img)!.push(row);
  });
  return Array.from(map.entries()).map(([src, rows]) => ({ src, rows }));
}

function isValidImage(img: string): boolean {
  // Minimal check; adjust as needed for your environment
  return !!img;
}

export default function ImageView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
}: LogComparisonProps) {
  const allImages = [value, ...(comparables ?? [])].map((val) => (val ?? "").toString());
  const allRowIndexes = [baseLogIndex, ...(comparisonLogsIndex ?? [])];

  const grouped = groupImagesByValue(allImages, allRowIndexes);

  const allEmpty = grouped.every((g) => !isValidImage(g.src));
  if (!grouped.length || allEmpty) {
    return <p className="text-destructive">No valid images to display</p>;
  }

  return (
    <div className="space-y-4">
      {grouped.map((group, idx) => {
        const { src, rows } = group;
        const rowText = compressRowNumbers(rows);

        if (!isValidImage(src)) {
          return (
            <div key={idx} className="border p-2 rounded bg-background">
              <h4 className="font-bold mb-2">Rows: {rowText}</h4>
              <p className="text-sm text-destructive">Not a valid image</p>
            </div>
          );
        }

        return (
          <div key={idx} className="border p-2 rounded bg-background flex flex-col width-fit">
            <h4 className="font-bold mb-2">Rows: {rowText}</h4>
            <ImageDisplay value={src} />
          </div>
        );
      })}
    </div>
  );
}