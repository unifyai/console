"use client";

import React, { Suspense, useState, useCallback} from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import { LogComparisonProps } from "./types";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import RowBadge from "./RowBadge";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";
import { ImageDisplay } from "@/utils/interfaces/selection/selection";

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

// Configure zoom settings for the lightbox
const zoomConfig = {
  maxZoomPixelRatio: 10, // Allow zooming up to 10x (default is 1-3)
  zoomInMultiplier: 1.2, // Smaller steps for more gradual zooming (default is 2)
  doubleTapDelay: 300, // Milliseconds for double tap/click detection
  doubleClickMaxStops: 3, // Max number of steps on double-click
  keyboardMoveDistance: 50, // Distance to move when using keyboard (pixels)
  wheelZoomDistanceFactor: 100, // Control the zoom speed with wheel
  pinchZoomDistanceFactor: 100, // Control pinch zoom sensitivity
};

// Lightbox configuration
const lightboxConfig = {
  carousel: {
    finite: true, // Prevent looping through images
  },
  animation: {
    swipe: 300, // Animation duration for swipe gestures
  },
  controller: {
    touchAction: "pan-y", // Allow vertical scrolling on mobile
  },
  // Hide navigation arrows since we only have one slide
  navigation: false
};

// New component to handle image display with lightbox
function LightboxWrapper({ 
  onOpenLightbox,
  children,
  className = "",
  sourceValue
}: { 
  onOpenLightbox: () => void;
  children: React.ReactNode;
  className?: string;
  sourceValue: string;
}) {
  // Check if it's a base64 image
  const isBase64 = typeof sourceValue === 'string' && (
    sourceValue.startsWith('data:image/') || 
    /^[A-Za-z0-9+/]+={0,2}$/.test(sourceValue)
  );

  return (
    <div className={`relative group ${className}`}>
      <button
        className="w-full text-left"
        onClick={onOpenLightbox}
      >
        {children}
      </button>
      <CopyButton
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
        content={sourceValue}
        copyMessage={isBase64 ? "Copied base64 data!" : "Copied image URL!"}
        tooltipContent={isBase64 ? "Copy base64 data" : "Copy image URL"}
      />
    </div>
  );
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
    Lightbox setup - simpler approach
  ───────────────────────────────────────────────────────────────────────────*/

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [lightboxError, setLightboxError] = useState<string | null>(null);

  // Helper function to check if a URL is a Google Cloud Storage URL
  const isGCSUrl = useCallback((url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === 'storage.googleapis.com';
    } catch (e) {
      console.error("Error parsing URL:", url, e);
      return false;
    }
  }, []);

  // Helper function to get a signed URL for Google Cloud Storage images
  const getSignedUrl = useCallback(async (gcsUrl: string): Promise<string> => {
    try {
      const parsedUrl = new URL(gcsUrl);
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      const bucket = pathParts[0];
      const path = pathParts.slice(1).join("/");
      
      const queryParams = new URLSearchParams({
        bucket: bucket,
        path: path
      });
      
      const res = await fetch(`/api/media/get?${queryParams}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch signed URL: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.url;
    } catch (err) {
      console.error("Error fetching signed URL:", err);
      throw err;
    }
  }, []);

  /**
   * Open the lightbox with the given image source
   * 
   * For Google Cloud Storage URLs, we need to fetch a signed URL first
   * to provide temporary access to the image. This ensures the lightbox
   * can properly display the image.
   */
  const openLightbox = useCallback(async (src: string) => {
    try {
      setLightboxLoading(true);
      setLightboxError(null);
      
      let finalSrc = src;
      // If this is a GCS URL, get a signed URL
      if (isGCSUrl(src)) {
        try {
          finalSrc = await getSignedUrl(src);
        } catch (error) {
          setLightboxError("Failed to get signed URL for image");
          setLightboxLoading(false);
          return;
        }
      }
      
      setLightboxSrc(finalSrc);
      setLightboxOpen(true);
      setLightboxLoading(false);
    } catch (error) {
      console.error("Error in openLightbox:", error);
      setLightboxError("Error opening lightbox");
      setLightboxLoading(false);
    }
  }, [isGCSUrl, getSignedUrl]);
  
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
            <LightboxWrapper 
              className="border rounded p-2 bg-background"
              onOpenLightbox={() => openLightbox(baseSrc)}
              sourceValue={baseSrc}
            >
              <Suspense fallback={<div>Loading image...</div>}>
                <ImageDisplay value={baseSrc} />
              </Suspense>
            </LightboxWrapper>
          )}
        </div>
        
        {/* Render the lightbox */}
        {lightboxOpen && lightboxSrc && (
          <>
            {lightboxLoading && <div className="p-4 text-center">Loading image...</div>}
            {lightboxError && <div className="p-4 text-center text-red-500 font-medium">Error: {lightboxError}</div>}
            {!lightboxLoading && !lightboxError && (
              <Lightbox
                open={lightboxOpen}
                close={() => {
                  setLightboxOpen(false);
                  setLightboxSrc(null);
                }}
                slides={[{ src: lightboxSrc }]}
                plugins={[Zoom]}
                zoom={zoomConfig}
                carousel={{ finite: true }}
                animation={{ swipe: 300 }}
                controller={{ touchAction: "pan-y" as const }}
                render={{
                  buttonPrev: () => null,
                  buttonNext: () => null
                }}
              />
            )}
          </>
        )}
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
                <div className="border rounded p-2 bg-background relative">
                  <RowBadge rowNumbers={rows} mode="none" />
                  {isNonEmptyImage(src) ? (
                    <LightboxWrapper 
                      onOpenLightbox={() => openLightbox(src)}
                      sourceValue={src}
                      className=""
                    >
                      <Suspense fallback={<div>Loading image...</div>}>
                        <ImageDisplay value={src} />
                      </Suspense>
                    </LightboxWrapper>
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
        
        {/* Render the lightbox */}
        {lightboxOpen && lightboxSrc && (
          <>
            {lightboxLoading && <div className="p-4 text-center">Loading image...</div>}
            {lightboxError && <div className="p-4 text-center text-red-500 font-medium">Error: {lightboxError}</div>}
            {!lightboxLoading && !lightboxError && (
              <Lightbox
                open={lightboxOpen}
                close={() => {
                  setLightboxOpen(false);
                  setLightboxSrc(null);
                }}
                slides={[{ src: lightboxSrc }]}
                plugins={[Zoom]}
                zoom={zoomConfig}
                carousel={{ finite: true }}
                animation={{ swipe: 300 }}
                controller={{ touchAction: "pan-y" as const }}
                render={{
                  buttonPrev: () => null,
                  buttonNext: () => null
                }}
              />
            )}
          </>
        )}
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
                <div className="border rounded p-2 bg-background relative">
                  <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />
                  {isNonEmptyImage(baseSrc) ? (
                    <Suspense fallback={<div>Loading image...</div>}>
                      <div className="pt-2">
                        <LightboxWrapper 
                          onOpenLightbox={() => openLightbox(baseSrc)}
                          sourceValue={baseSrc}
                          className=""
                        >
                          <ImageDisplay value={baseSrc} />
                        </LightboxWrapper>
                      </div>
                    </Suspense>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No image
                    </p>
                  )}
                </div>

                {/* (2) Comparable block */}
                <div className="border rounded p-2 bg-background relative">
                  <RowBadge rowNumbers={rowNums} mode={compBadgeMode} />
                  {isNonEmptyImage(compSrc) ? (
                    <Suspense fallback={<div>Loading image...</div>}>
                      <div className="pt-2">
                        <LightboxWrapper 
                          onOpenLightbox={() => openLightbox(compSrc)}
                          sourceValue={compSrc}
                          className=""
                        >
                          <ImageDisplay value={compSrc} />
                        </LightboxWrapper>
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
      
      {/* Render the lightbox */}
      {lightboxOpen && lightboxSrc && (
        <>
          {lightboxLoading && <div className="p-4 text-center">Loading image...</div>}
          {lightboxError && <div className="p-4 text-center text-red-500 font-medium">Error: {lightboxError}</div>}
          {!lightboxLoading && !lightboxError && (
            <Lightbox
              open={lightboxOpen}
              close={() => {
                setLightboxOpen(false);
                setLightboxSrc(null);
              }}
              slides={[{ src: lightboxSrc }]}
              plugins={[Zoom]}
              zoom={zoomConfig}
              carousel={{ finite: true }}
              animation={{ swipe: 300 }}
              controller={{ touchAction: "pan-y" as const }}
              render={{
                buttonPrev: () => null,
                buttonNext: () => null
              }}
            />
          )}
        </>
      )}
    </div>
  );
}