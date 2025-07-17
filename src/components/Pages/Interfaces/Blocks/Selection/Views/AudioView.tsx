"use client";

import React from "react";
import { LogComparisonProps } from "./types";
import RowBadge from "./RowBadge";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { AudioPlayer } from "@/utils/interfaces/selection/selection";
import { ExternalLink } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

/**
 * Determine if the string represents a valid audio URL or path
 */
function isNonEmptyAudio(value: string) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Group audio files by their raw value.
 */
function groupAudiosByValue(audios: string[], rowIndices: number[]) {
  const map = new Map<string, number[]>();
  audios.forEach((audio, i) => {
    if (!map.has(audio)) {
      map.set(audio, []);
    }
    map.get(audio)!.push(rowIndices[i]);
  });
  return Array.from(map.entries()).map(([audioUrl, rows]) => ({
    audioUrl,
    rows: rows.sort((a, b) => a - b),
  }));
}

/**
 * Group row indices by their version text for proper display
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
  return Array.from(map.entries()).map(([versionText, rowArr]) => ({
    versionText,
    rows: rowArr.sort((a, b) => a - b),
  }));
}

/**
 * Main AudioView component for rendering audio players
 */
export default function AudioView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  version = "",
  comparableVersions = [],
}: LogComparisonProps) {
  const singleMode = !comparables || comparables.length === 0;
  const baseUrl = String(value ?? "");
  const compUrls = (comparables ?? []).map((c) => String(c ?? ""));
  const baseVersion = version || "";
  const compVers = comparableVersions || [];
  const versionEmpty = !baseVersion && compVers.every((v) => !v);

  // SINGLE MODE: Just the base audio
  if (singleMode) {
    const hasAudio = isNonEmptyAudio(baseUrl);

    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold text-sm">Version</p>
            {baseVersion ? (
              <div className="border rounded p-2 relative group">
                <MarkdownRenderer>{baseVersion}</MarkdownRenderer>
                <CopyButton
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  content={baseVersion}
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
          {!versionEmpty && <p className="font-semibold text-sm">Audio</p>}
          {!hasAudio ? (
            <p className="text-sm italic text-muted-foreground">No audio</p>
          ) : (
            <div className="border rounded p-2 bg-background relative group">
                <div className="pr-16 flex-grow mb-2">
                    <p className="text-sm break-all">{baseUrl}</p>
                </div>
                 <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionButton
                        variant="ghost"
                        tooltip="Open in new tab"
                        aria-label="Open in new tab"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(baseUrl, '_blank');
                        }}
                        icon={<ExternalLink className="h-4 w-4" />}
                    />
                    <CopyButton 
                      content={baseUrl} 
                      copyMessage="Copied URL!" 
                      tooltipContent="Copy URL"
                    />
                 </div>
                <AudioPlayer value={baseUrl} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // MULTIPLE MODE: Group identical audio URLs
  const allVals = [baseUrl, ...compUrls];
  const rowIndices = [baseLogIndex, ...comparisonLogsIndex];
  const grouped = groupAudiosByValue(allVals, rowIndices);

  const filtered = grouped.filter((g) => isNonEmptyAudio(g.audioUrl));

  return (
    <div className="space-y-4">
      {filtered.map((group, idx) => {
        const { audioUrl, rows } = group;
        const verGroups = groupVersionsForRows(rows, baseLogIndex, baseVersion, comparisonLogsIndex, compVers);

        return (
          <div key={idx} className="border rounded p-3 space-y-4">
            {!versionEmpty && (
              <>
                <p className="font-semibold text-sm">Version</p>
                <div className="space-y-2">
                  {verGroups.map((vg, j) => (
                    <div key={j} className="border rounded p-2 relative group">
                      <RowBadge rowNumbers={vg.rows} mode="none" />
                      {vg.versionText ? (
                        <div className="pt-4">
                          <MarkdownRenderer>{vg.versionText}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="italic text-sm text-muted-foreground pt-2">No version</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="space-y-2">
              {!versionEmpty && <p className="font-semibold text-sm">Audio</p>}
              <div className="border rounded p-2 relative group">
                <RowBadge rowNumbers={rows} mode="none" />
                <div className="pr-16 mt-3 mb-2">
                    <p className="text-sm break-all">{audioUrl}</p>
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionButton
                        variant="ghost"
                        tooltip="Open in new tab"
                        aria-label="Open in new tab"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(audioUrl, '_blank');
                        }}
                        icon={<ExternalLink className="h-4 w-4" />}
                    />
                  <CopyButton 
                    content={audioUrl} 
                    copyMessage="Copied URL!" 
                    tooltipContent="Copy URL"
                  />
                </div>
                <AudioPlayer value={audioUrl} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}