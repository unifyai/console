"use client";
import React from "react";
import { ImageDisplay } from "@/utils/evals/selection";
import { LogComparisonProps } from "./types";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import RowBadge from "./RowBadge";
import MarkdownRenderer from "./MarkdownRenderer";

/**
 * Compress array of row indices (e.g. [1,2,3,5,6,8]) into "1-3,5-6,8".
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
 * Group images by exact src string, so that identical images share a group.
 */
function groupImagesByValue(images: string[], rowIndexes: number[]) {
  const map = new Map<string, number[]>();
  images.forEach((img, i) => {
    if (!map.has(img)) {
      map.set(img, []);
    }
    map.get(img)!.push(rowIndexes[i]);
  });
  return Array.from(map.entries()).map(([src, rows]) => ({
    src,
    rows: rows.sort((a, b) => a - b),
  }));
}

/**
 * Group row indices by their version text, to display them in a single block if they share the same version.
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
    const verStr =
      r === baseLogIndex
        ? baseVer
        : compVers[compLogIndexes.indexOf(r)] ?? "";
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
 * Minimal presence “diff” marker for images:
 * If base has content, but comp = "",
 * or base is "", but comp has content => highlight as red/green.
 */
function gatherPresenceDiffs(
  baseSrc: string,
  compSrcs: string[],
  baseIdx: number,
  compIdxs: number[]
) {
  const baseHas = baseSrc !== "";
  const redSet: Set<number> = new Set();
  const greenSet: Set<number> = new Set();

  compSrcs.forEach((val, i) => {
    const row = compIdxs[i];
    if (baseHas && val === "") {
      redSet.add(row);
    } else if (!baseHas && val !== "") {
      greenSet.add(row);
    }
  });

  return {
    redRows: Array.from(redSet).sort((a, b) => a - b),
    greenRows: Array.from(greenSet).sort((a, b) => a - b),
  };
}

function isValidImage(src: string): boolean {
  // Minimal check for demonstration
  return !!src;
}

export default function ImageView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
  version = "",
  comparableVersions = [],
}: LogComparisonProps) {
  const singleMode = !comparables || comparables.length === 0;
  const baseSrc = (value ?? "").toString();
  const compSrcs = (comparables ?? []).map((c) => (c ?? "").toString());
  const baseVer = version.toString();
  const compVers = comparableVersions.map((v) => v.toString());
  const versionEmpty = baseVer === "" && compVers.every((v) => v === "");

  // SINGLE MODE
  if (singleMode) {
    const hasImg = isValidImage(baseSrc);
    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold">Version</p>
            {baseVer ? (
              <div className="border rounded p-2 relative">
                <MarkdownRenderer>{baseVer}</MarkdownRenderer>
                <CopyButton
                  className="absolute top-1 right-1"
                  content={baseVer}
                  copyMessage="Copied version!"
                  tooltipContent="Copy version"
                />
              </div>
            ) : (
              <p className="italic text-sm text-muted-foreground">No version</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="font-semibold">Image</p>
          {!hasImg ? (
            <p className="text-sm italic text-muted-foreground">No image</p>
          ) : (
            <div className="border rounded p-2 bg-background">
              <ImageDisplay value={baseSrc} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // MULTI MODE => base + comparables exist
  if (diffMode === "none") {
    // Group them ignoring base vs comp
    const allSources = [baseSrc, ...compSrcs];
    const allRows = [baseLogIndex, ...comparisonLogsIndex];
    const groups = groupImagesByValue(allSources, allRows);

    return (
      <div className="space-y-4">
        {groups.map((grp, idx) => {
          const src = grp.src;
          const rowNums = grp.rows;
          const verGroups = groupVersionsForRows(
            rowNums,
            baseLogIndex,
            baseVer,
            comparisonLogsIndex,
            compVers
          );

          return (
            <div key={idx} className="border rounded p-3 space-y-4">
              {!versionEmpty && (
                <div className="space-y-2">
                  <p className="font-semibold">Param Version</p>
                  {verGroups.map((vg, j) => (
                    <div
                      key={j}
                      className="space-y-2 border rounded p-2 relative"
                    >
                      <RowBadge rowNumbers={vg.rows} mode="none" />
                      <CopyButton
                        className="absolute top-2 right-2"
                        content={vg.text}
                        copyMessage="Copied version!"
                        tooltipContent="Copy version"
                      />
                      {vg.text ? (
                        <div className="pt-2">
                          <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="italic text-sm text-muted-foreground">
                          No version
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="font-semibold">Image</p>
                <div className="border rounded p-2 bg-background relative">
                  <RowBadge rowNumbers={rowNums} mode="none" />
                  {isValidImage(src) ? (
                    <div className="pt-2">
                      <ImageDisplay value={src} />
                    </div>
                  ) : (
                    <p className="text-destructive">Not a valid image</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // For lines/words/characters diff => “presence” highlight only
  const { redRows, greenRows } = gatherPresenceDiffs(
    baseSrc,
    compSrcs,
    baseLogIndex,
    comparisonLogsIndex
  );

  // Merge comparables by unique src
  const compMap = new Map<string, number[]>();
  compSrcs.forEach((src, i) => {
    const row = comparisonLogsIndex[i];
    if (!compMap.has(src)) {
      compMap.set(src, []);
    }
    compMap.get(src)!.push(row);
  });
  const compBlocks = Array.from(compMap.entries()).map(([src, rows]) => ({
    src,
    rows: rows.sort((a, b) => a - b),
  }));

  return (
    <div className="space-y-4">
      {compBlocks.map((block, i) => {
        const compSrc = block.src;
        const rowNums = block.rows;

        // Param version grouping
        const verGroups = groupVersionsForRows(
          rowNums.concat(baseLogIndex),
          baseLogIndex,
          baseVer,
          comparisonLogsIndex,
          compVers
        );

        // If same as base => no highlight
        const changed = compSrc !== baseSrc;
        const baseBadgeMode = changed ? "delete" : "none";
        const compBadgeMode = changed ? "insert" : "none";

        return (
          <div key={i} className="border rounded p-3 space-y-4">
            {!versionEmpty && (
              <div className="space-y-2">
                <p className="font-semibold">Param Version</p>
                {verGroups.map((vg, j) => {
                  return (
                    <div key={j} className="p-3 space-y-2 border rounded relative">
                      <div className="flex items-center gap-2 text-xs">
                        {vg.rows.includes(baseLogIndex) && (
                          <RowBadge
                            rowNumbers={[baseLogIndex]}
                            mode={changed ? "delete" : "none"}
                          />
                        )}
                        <RowBadge
                          rowNumbers={vg.rows.filter((r) => r !== baseLogIndex)}
                          mode={changed ? "insert" : "none"}
                        />
                      </div>
                      {vg.text ? (
                        <div className="pt-2">
                          <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="italic text-sm text-muted-foreground">
                          No version
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <p className="font-semibold">Image Diff</p>
              <div className="flex items-center gap-2 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />
                <RowBadge rowNumbers={rowNums} mode={compBadgeMode} />
              </div>
              <div className="border rounded p-2 bg-background">
                {isValidImage(compSrc) || isValidImage(baseSrc) ? (
                  <div className="flex flex-col gap-4">
                    {isValidImage(baseSrc) && (
                      <div>
                        <p className="text-xs italic mb-1">Base image</p>
                        <ImageDisplay value={baseSrc} />
                      </div>
                    )}
                    {isValidImage(compSrc) && (
                      <div>
                        <p className="text-xs italic mb-1">Comparison image</p>
                        <ImageDisplay value={compSrc} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-destructive">No valid images</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}