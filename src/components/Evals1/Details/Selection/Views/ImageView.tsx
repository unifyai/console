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
 * Given parallel arrays of images (as strings) and row indexes,
 * groups identical images into an object { src, rows: number[] }.
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

/**
 * A small helper to decide if a string is a "valid" image. 
 * (You can adjust this check as needed for your environment.)
 */
function isValidImage(img: string): boolean {
  return !!img; // treat non-empty strings as valid images
}

/**
 * ImageView:
 * 1) Combines base + comparables into two arrays: allImages, allRowIndexes.
 * 2) Groups identical images so each distinct image is displayed once 
 *    with a "Rows: x-y" label (like the multi trace grouping).
 * 3) If all are invalid or empty, renders an error.
 */
const ImageView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex
}) => {
  // Combine base + comparables into arrays
  const allImages = [value, ...(comparables ?? [])].map((img) => (img ?? "").toString());
  const allRowIndexes = [baseLogIndex, ...(comparisonLogsIndex ?? [])];

  // Group identical images together
  const grouped = groupImagesByValue(allImages, allRowIndexes);

  // If no images or all are empty strings => show an error
  const allEmpty = grouped.every((g) => !isValidImage(g.src));
  if (!grouped.length || allEmpty) {
    return <p className="text-destructive">No valid images to display</p>;
  }

  return (
    <div className="space-y-4">
      {grouped.map((group, idx) => {
        const { src, rows } = group;
        if (!isValidImage(src)) {
          // Show that it's invalid but note which rows had it
          const rowText = compressRowNumbers(rows);
          return (
            <div key={idx} className="border p-2 rounded bg-background">
              <h4 className="font-bold mb-2">Rows: {rowText}</h4>
              <p className="text-sm text-destructive">Not a valid image</p>
            </div>
          );
        }

        // We have a valid image -> compress & show row indexes
        const rowText = compressRowNumbers(rows);
        return (
          <div key={idx} className="border p-2 rounded bg-background">
            <h4 className="font-bold mb-2">Rows: {rowText}</h4>
            <ImageDisplay value={src} />
          </div>
        );
      })}
    </div>
  );
};

export default ImageView;