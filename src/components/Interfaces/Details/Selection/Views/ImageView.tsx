"use client";

import React, { Suspense } from "react";
import { LogComparisonProps } from "./types";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import RowBadge from "./RowBadge";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";
import { ImageDisplay } from "@/utils/evals/selection";

/**
 * Evaluate if the provided string is a non-empty image reference.
 * We'll treat any non-empty string as "displayable" for now,
 * and rely on <ImageDisplay> to handle errors or fallback states.
 */
function isNonEmptyImage(value: string) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Group images by their raw value (the private/log URL). This ensures identical
 * log strings are recognized as the same image, regardless of whether they
 * become different signed URLs later.
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
 * Simple presence-diff helper:
 * - If the base has an image, but a comparable is empty => "deleted" in comp
 * - If the base is empty, but a comparable has an image => "inserted" in comp
 */
function gatherPresenceDiffs(
  baseSrc: string,
  compSrcs: string[],
  baseIdx: number,
  compIdxs: number[]
) {
  const baseHas = baseSrc !== "";
  const redSet = new Set<number>();
  const greenSet = new Set<number>();

  compSrcs.forEach((val, i) => {
    const row = compIdxs[i];
    if (baseHas && val === "") {
      // base has image, comp is empty => "delete" in comp
      redSet.add(row);
    } else if (!baseHas && val !== "") {
      // base is empty, comp has image => "insert" in comp
      greenSet.add(row);
    }
  });

  return {
    redRows: Array.from(redSet).sort((a, b) => a - b),
    greenRows: Array.from(greenSet).sort((a, b) => a - b),
  };
}

/**
 * Group row indices by param version, so we can show them together if they share the same string.
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
    if (r === baseLogIndex) {
      map.has(baseVer) || map.set(baseVer, []);
      map.get(baseVer)!.push(r);
    } else {
      const idxInComp = compLogIndexes.indexOf(r);
      const verStr = idxInComp >= 0 ? compVers[idxInComp] : "";
      map.has(verStr) || map.set(verStr, []);
      map.get(verStr)!.push(r);
    }
  });
  return Array.from(map.entries()).map(([text, rowArr]) => ({
    text,
    rows: rowArr.sort((a, b) => a - b),
  }));
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
  // Convert the base and comparables to strings for uniform handling
  const baseSrc = String(value ?? "");
  const compSrcs = (comparables ?? []).map((c) => String(c ?? ""));

  const singleMode = !comparables || comparables.length === 0;
  const baseVer = version || "";
  const compVers = comparableVersions || [];
  const versionEmpty = !baseVer && compVers.every((v) => !v);

  /*───────────────────────────────────────────────────────────────────────────
    SINGLE MODE: Just show the one image, optional version
  ───────────────────────────────────────────────────────────────────────────*/
  if (singleMode) {
    const hasImage = isNonEmptyImage(baseSrc);

    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold text-sm">Version</p>
            {baseVer ? (
              <div className="border rounded p-2 relative group">
                <MarkdownRenderer>{baseVer}</MarkdownRenderer>
                <CopyButton
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
          {!versionEmpty && <p className="font-semibold text-sm">Image</p>}
          {!hasImage ? (
            <p className="text-sm italic text-muted-foreground">No image</p>
          ) : (
            <div className="border rounded p-2 bg-background group relative">
              <Suspense fallback={<div>Loading image...</div>}>
                <ImageDisplay value={baseSrc} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    );
  }

  /*───────────────────────────────────────────────────────────────────────────
    MULTI MODE: We have base + comparables
  ───────────────────────────────────────────────────────────────────────────*/

  // (A) "No diff" => group identical raw strings so one image is shown for all rows that share it
  if (diffMode === "none") {
    const allSources = [baseSrc, ...compSrcs];
    const allRows = [baseLogIndex, ...comparisonLogsIndex];
    const groups = groupImagesByValue(allSources, allRows);

    // Filter out groups with empty images
    const filteredGroups = groups.filter(group => isNonEmptyImage(group.src));

    return (
      <div className="space-y-4">
        {filteredGroups.map((grp, i) => {
          const { src, rows } = grp;
          const versionGroups = groupVersionsForRows(
            rows,
            baseLogIndex,
            baseVer,
            comparisonLogsIndex,
            compVers
          );

          return (
            <div key={i} className="border rounded p-3 space-y-4">
              {/* Param Versions */}
              {!versionEmpty && (
                <>
                  <p className="font-semibold text-sm">Version</p>
                  <div className="space-y-2">
                    {versionGroups.map((vg, j) => (
                      <div
                        key={j}
                        className="border rounded p-2 relative group"
                      >
                        <RowBadge rowNumbers={vg.rows} mode="none" />
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
                </>
              )}

              {/* The actual image */}
              <div className="space-y-2">
                {!versionEmpty && <p className="font-semibold text-sm">Image</p>}
                <div className="border rounded p-2 bg-background relative group">
                  <RowBadge rowNumbers={rows} mode="none" />
                  {isNonEmptyImage(src) ? (
                    <Suspense fallback={<div>Loading image...</div>}>
                      <ImageDisplay value={src} />
                    </Suspense>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No image
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // (B) If diffMode !== "none", we do a side-by-side approach
  // mapping each unique comp src => which row(s) it's in
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

        // Combine the base row + these row(s) for grouping versions
        const allRows = [baseLogIndex, ...rowNums];
        const versionGroups = groupVersionsForRows(
          allRows,
          baseLogIndex,
          baseVer,
          comparisonLogsIndex,
          compVers
        );

        // If base === comp => no highlight
        const changed = compSrc !== baseSrc;
        const baseBadgeMode = changed ? "delete" : "none";
        const compBadgeMode = changed ? "insert" : "none";

        return (
          <div key={i} className="border rounded p-3 space-y-4">
            {!versionEmpty && (
              <>
                <p className="font-semibold text-sm">Version</p>
                <div className="space-y-2">
                  {versionGroups.map((vg, j) => {
                    const rowSet = vg.rows;
                    const hasBase = rowSet.includes(baseLogIndex);
                    // Show base row with "delete" if changed, otherwise "none"
                    const baseMode = hasBase && changed ? "delete" : "none";

                    // For the other rows in rowSet, "insert" if changed
                    const otherRows = rowSet.filter((r) => r !== baseLogIndex);

                    return (
                      <div
                        key={j}
                        className="border rounded p-2 relative group"
                      >
                        <div className="flex items-center gap-2 text-xs mb-2">
                          {hasBase && (
                            <RowBadge
                              rowNumbers={[baseLogIndex]}
                              mode={baseMode}
                            />
                          )}
                          {otherRows.length > 0 && (
                            <RowBadge
                              rowNumbers={otherRows}
                              mode={changed ? "insert" : "none"}
                            />
                          )}
                        </div>
                        {vg.text ? (
                          <MarkdownRenderer>{vg.text}</MarkdownRenderer>
                        ) : (
                          <p className="italic text-sm text-muted-foreground">
                            No version
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="space-y-2">
              {!versionEmpty && <p className="font-semibold text-sm">Image Diff</p>}

              <div className="flex flex-col gap-4">
                {/* (1) Base block */}
                <div className="border rounded p-2 bg-background relative group">
                  <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />
                  {isNonEmptyImage(baseSrc) ? (
                    <Suspense fallback={<div>Loading image...</div>}>
                      <div className="pt-2">
                        <ImageDisplay value={baseSrc} />
                      </div>
                    </Suspense>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No image
                    </p>
                  )}
                </div>

                {/* (2) Comparable block */}
                <div className="border rounded p-2 bg-background relative group">
                  <RowBadge rowNumbers={rowNums} mode={compBadgeMode} />
                  {isNonEmptyImage(compSrc) ? (
                    <Suspense fallback={<div>Loading image...</div>}>
                      <div className="pt-2">
                        <ImageDisplay value={compSrc} />
                      </div>
                    </Suspense>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No image
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}