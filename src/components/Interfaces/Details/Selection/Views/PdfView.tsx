"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { LogComparisonProps } from "./types";
import RowBadge from "./RowBadge";
import MarkdownRenderer from "./Markdown/MarkdownRenderer";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/UI/dialog";
import { AlertCircle, ExternalLink, FileText} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/UI/tabs";
import ActionButton from "@/components/Common/Buttons/Action";

/**
 * Determine if the string represents a valid PDF URL or path
 */
function isNonEmptyPdf(value: string) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Group PDFs by their raw value. This ensures identical
 * PDF references are recognized as the same, regardless of any
 * query parameters or transformations.
 */
function groupPdfsByValue(pdfs: string[], rowIndices: number[]) {
  const map = new Map<string, number[]>();
  pdfs.forEach((pdf, i) => {
    if (!map.has(pdf)) {
      map.set(pdf, []);
    }
    map.get(pdf)!.push(rowIndices[i]);
  });
  return Array.from(map.entries()).map(([pdfUrl, rows]) => ({
    pdfUrl,
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
    if (r === baseLogIndex) {
      if (!map.has(baseVer)) map.set(baseVer, []);
      map.get(baseVer)!.push(r);
    } else {
      const idx = compLogIndexes.indexOf(r);
      const ver = idx >= 0 ? compVers[idx] : "";
      if (!map.has(ver)) map.set(ver, []);
      map.get(ver)!.push(r);
    }
  });
  return Array.from(map.entries()).map(([versionText, rowArr]) => ({
    versionText,
    rows: rowArr.sort((a, b) => a - b),
  }));
}

/**
 * PDF IFrame with error handling
 */
function PdfFrame({ url }: { url: string }) {
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    // Reset error state when URL changes
    setHasError(false);
    
    // Setup error detection through window event listener
    const handleIframeError = () => {
      setHasError(true);
    };
    
    window.addEventListener('error', handleIframeError, true);
    
    return () => {
      window.removeEventListener('error', handleIframeError, true);
    };
  }, [url]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="w-10 h-10 text-yellow-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">Content Security Policy Restriction</h3>
        <p className="mb-4">This PDF cannot be embedded due to security restrictions set by the website.</p>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Open PDF in New Tab <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={url}
      className="w-full h-full border-none"
      title="PDF Preview"
      onError={() => setHasError(true)}
    />
  );
}

// Add a new interface for PDF tab items
interface PdfTab {
  url: string;
  label: string;
}

/**
 * Custom button for opening links in new tabs
 */
function OpenInNewTabButton({ url, className }: { url: string, className?: string }) {
  return (
    <ActionButton
      variant="ghost"
      tooltip="Open in new tab"
      className={className}
      aria-label="Open in new tab"
      onClick={(e) => {
        e.stopPropagation();
        window.open(url, '_blank');
      }}
      icon={<ExternalLink className="h-2 w-2" />}
    />
  );
}

/**
 * Main PdfView component for rendering PDF references
 */
export default function PdfView({
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
  const baseUrl = String(value ?? "");
  const compUrls = (comparables ?? []).map((c) => String(c ?? ""));
  const baseVersion = version || "";
  const compVers = comparableVersions || [];
  const versionEmpty = !baseVersion && compVers.every((v) => !v);

  // State for PDF dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activePdf, setActivePdf] = useState<string>("");
  
  // New state for multi-tab PDF viewer
  const [pdfTabs, setPdfTabs] = useState<PdfTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Function to open a single PDF
  const openPdf = useCallback((pdfUrl: string, label?: string) => {
    setActivePdf(pdfUrl);
    setPdfTabs([{ url: pdfUrl, label: label || getPdfFilename(pdfUrl) }]);
    setActiveTabIndex(0);
    setDialogOpen(true);
  }, []);

  // Function to open multiple PDFs in tabs
  const openMultiplePdfs = useCallback((pdfs: PdfTab[]) => {
    if (pdfs.length === 0) return;
    
    setPdfTabs(pdfs);
    setActivePdf(pdfs[0].url);
    setActiveTabIndex(0);
    setDialogOpen(true);
  }, []);

  // Extract filename from URL for tab labels
  const getPdfFilename = (url: string): string => {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split('/').pop() || 'PDF';
      return filename.length > 20 ? filename.substring(0, 17) + '...' : filename;
    } catch {
      // For non-URL strings, just use the last part after /
      const parts = url.split('/');
      const filename = parts[parts.length - 1] || 'PDF';
      return filename.length > 20 ? filename.substring(0, 17) + '...' : filename;
    }
  };

  // Helper to create the PDF URL display with inspect and copy buttons
  const PdfUrlDisplay = ({ url, label }: { url: string; label?: string }) => (
    <div className="text-sm break-all">
      <a
        onClick={() => openPdf(url, label)}
        className="text-primary hover:underline cursor-pointer"
      >
        {url}
      </a>
    </div>
  );

  // New component: Button to view multiple PDFs
  const ViewMultiplePdfsButton = ({ pdfs }: { pdfs: { url: string, label: string }[] }) => {
    if (pdfs.length === 0) return null;
    
    return (
      <button
        onClick={() => openMultiplePdfs(pdfs)}
        className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm group"
      >
        <FileText className="h-4 w-4" />
        <span className="group-hover:underline">View all Selected PDFs</span>
      </button>
    );
  };

  // SINGLE MODE: No comparables
  if (singleMode) {
    const hasPdf = isNonEmptyPdf(baseUrl);

    return (
      <div className="space-y-4">
        {!versionEmpty && (
          <div className="space-y-2">
            <p className="font-semibold text-sm">Version</p>
            {baseVersion ? (
              <div className="border rounded p-2 relative group">
                <MarkdownRenderer>{baseVersion}</MarkdownRenderer>
                <CopyButton
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  content={baseVersion}
                  copyMessage="Copied version!"
                />
              </div>
            ) : (
              <p className="italic text-sm text-muted-foreground">No version</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {!versionEmpty && <p className="font-semibold text-sm">PDF</p>}
          {hasPdf ? (
            <div className="border rounded p-2 relative group">
              <div className="pr-16">
                <PdfUrlDisplay url={baseUrl} />
              </div>
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <OpenInNewTabButton url={baseUrl} />
                <CopyButton 
                  content={baseUrl} 
                  copyMessage="Copied URL!" 
                  tooltipContent="Copy URL"
                />
              </div>
            </div>
          ) : (
            <p className="italic text-sm text-muted-foreground">No PDF</p>
          )}
        </div>

        {/* PDF Dialog with tabs */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent 
            className="max-w-full w-full p-0 h-[90vh] flex flex-col"
            aria-describedby="pdf-dialog-description"
          >
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle>PDF Preview</DialogTitle>
              {pdfTabs.length > 1 && (
                <Tabs 
                  defaultValue={pdfTabs[0].url} 
                  value={activePdf} 
                  onValueChange={(value) => {
                    setActivePdf(value);
                    setActiveTabIndex(pdfTabs.findIndex(tab => tab.url === value));
                  }}
                >
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {pdfTabs.map((tab, index) => (
                      <TabsTrigger 
                        key={index} 
                        value={tab.url}
                        className="whitespace-nowrap"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </DialogHeader>
            <div className="flex-grow overflow-auto p-4">
              {activePdf && <PdfFrame url={activePdf} />}
            </div>
            <div id="pdf-dialog-description" className="sr-only">
              PDF viewer with interactive tabs for viewing multiple documents
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // MULTIPLE MODE: Base + comparables
  if (diffMode === "none") {
    // Group identical PDF URLs across base + comps
    const allVals = [baseUrl, ...compUrls];
    const rowIndices = [baseLogIndex, ...comparisonLogsIndex];
    const grouped = groupPdfsByValue(allVals, rowIndices);

    // Filter out empties
    const filtered = grouped.filter((g) => isNonEmptyPdf(g.pdfUrl));

    // Create a list of all unique PDFs for multi-view
    const allPdfs = filtered.map(group => ({
      url: group.pdfUrl,
      label: `${group.rows.length === 1 ? 'Row' : 'Rows'} ${group.rows.map(r => r + 1).join(', ')}`
    }));

    return (
      <div className="space-y-4">
        {/* Move the "View All PDFs" button to the top */}
        {filtered.length > 1 && (
          <ViewMultiplePdfsButton pdfs={allPdfs} />
        )}

        {filtered.map((group, idx) => {
          const { pdfUrl, rows } = group;
          // Group by version
          const verGroups = groupVersionsForRows(rows, baseLogIndex, baseVersion, comparisonLogsIndex, compVers);

          return (
            <div key={idx} className="p-3 space-y-4">
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

              {/* The PDF link */}
              <div className="space-y-2">
                {!versionEmpty && <p className="font-semibold text-sm">PDF</p>}
                <div className="border rounded p-2 relative group">
                  <RowBadge rowNumbers={rows} mode="none" />
                  <div className="pr-16 mt-3">
                    <PdfUrlDisplay url={pdfUrl} />
                  </div>
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <OpenInNewTabButton url={pdfUrl} />
                    <CopyButton 
                      content={pdfUrl} 
                      copyMessage="Copied URL!" 
                      tooltipContent="Copy URL"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* PDF Dialog with tabs */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent 
            className="max-w-full w-full p-0 h-[90vh] flex flex-col"
            aria-describedby="pdf-dialog-description"
          >
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle>PDF Preview</DialogTitle>
              {pdfTabs.length > 1 && (
                <Tabs 
                  defaultValue={pdfTabs[0].url} 
                  value={activePdf} 
                  onValueChange={(value) => {
                    setActivePdf(value);
                    setActiveTabIndex(pdfTabs.findIndex(tab => tab.url === value));
                  }}
                  className="mt-6"
                >
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {pdfTabs.map((tab, index) => (
                      <TabsTrigger 
                        key={index} 
                        value={tab.url}
                        className="whitespace-nowrap"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </DialogHeader>
            <div className="flex-grow overflow-auto p-4">
              {activePdf && <PdfFrame url={activePdf} />}
            </div>
            <div id="pdf-dialog-description" className="sr-only">
              PDF viewer with interactive tabs for viewing multiple documents
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // DIFF MODE: Side-by-side comparison
  const compGroups = new Map<string, number[]>();
  compUrls.forEach((url, i) => {
    const row = comparisonLogsIndex[i];
    if (!compGroups.has(url)) compGroups.set(url, []);
    compGroups.get(url)!.push(row);
  });
  
  // Add entry for each unique URL in compGroups
  const compBlocks = Array.from(compGroups.entries()).map(([url, rows]) => ({
    url,
    rows: rows.sort((a, b) => a - b),
  }));

  // Create a list of all comp PDFs for multi-view
  const allCompPdfs = compBlocks.map(block => ({
    url: block.url,
    label: `Comp PDF (${block.rows.length === 1 ? 'Row' : 'Rows'} ${block.rows.map(r => r + 1).join(', ')})`
  }));

  // Collect all PDFs for tabbed viewing
  const allDiffPdfs: PdfTab[] = [];
  if (isNonEmptyPdf(baseUrl)) {
    allDiffPdfs.push({
      url: baseUrl,
      label: `Base PDF (Row ${baseLogIndex + 1})`
    });
  }
  
  compBlocks.forEach((block) => {
    if (isNonEmptyPdf(block.url)) {
      allDiffPdfs.push({
        url: block.url,
        label: `Comp PDF (${block.rows.length === 1 ? 'Row' : 'Rows'} ${block.rows.map(r => r + 1).join(', ')})`
      });
    }
  });

  return (
    <div className="space-y-4">
      {/* Move "View All PDFs" button to the top */}
      {allDiffPdfs.length > 1 && (
        <ViewMultiplePdfsButton pdfs={allDiffPdfs} />
      )}

      {compBlocks.map((block, i) => {
        const { url, rows } = block;
        const changed = url !== baseUrl;
        const baseBadgeMode = changed ? "delete" : "none";
        const compBadgeMode = changed ? "insert" : "none";

        const allRows = [baseLogIndex, ...rows];
        const verGroups = groupVersionsForRows(allRows, baseLogIndex, baseVersion, comparisonLogsIndex, compVers);

        return (
          <div key={i} className="p-3 space-y-4">
            {/* Show versions if available */}
            {!versionEmpty && (
              <>
                <p className="font-semibold text-sm">Version</p>
                <div className="space-y-2">
                  {verGroups.map((vg, j) => {
                    const hasBase = vg.rows.includes(baseLogIndex);
                    return (
                      <div key={j} className="border rounded p-2 relative group">
                        <div className="flex gap-1 text-xs">
                          {hasBase && <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />}
                          <RowBadge 
                            rowNumbers={vg.rows.filter(r => r !== baseLogIndex)} 
                            mode={compBadgeMode} 
                          />
                        </div>
                        {vg.versionText ? (
                          <div className="pt-4">
                            <MarkdownRenderer>{vg.versionText}</MarkdownRenderer>
                          </div>
                        ) : (
                          <p className="italic text-sm text-muted-foreground pt-2">No version</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="space-y-2">
              <p className="font-semibold text-sm">PDF Diff</p>

              {/* Base PDF */}
              <div className="border rounded p-2 relative group">
                <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />
                {isNonEmptyPdf(baseUrl) ? (
                  <>
                    <div className="pr-16 mt-3">
                      <PdfUrlDisplay url={baseUrl} />
                    </div>
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <OpenInNewTabButton url={baseUrl} />
                      <CopyButton 
                        content={baseUrl} 
                        copyMessage="Copied URL!" 
                        tooltipContent="Copy URL"
                      />
                    </div>
                  </>
                ) : (
                  <p className="italic text-sm text-muted-foreground pt-2">No PDF</p>
                )}
              </div>

              {/* Arrow */}
              <div className="font-bold text-xl flex justify-center">→</div>

              {/* Comparable PDF */}
              <div className="border rounded p-2 relative group">
                <RowBadge rowNumbers={rows} mode={compBadgeMode} />
                {isNonEmptyPdf(url) ? (
                  <>
                    <div className="pr-16 mt-3">
                      <PdfUrlDisplay url={url} />
                    </div>
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <OpenInNewTabButton url={url} />
                      <CopyButton 
                        content={url} 
                        copyMessage="Copied URL!" 
                        tooltipContent="Copy URL"
                      />
                    </div>
                  </>
                ) : (
                  <p className="italic text-sm text-muted-foreground pt-2">No PDF</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* PDF Dialog with tabs */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent 
          className="max-w-full w-full p-0 h-[90vh] flex flex-col"
          aria-describedby="pdf-dialog-description"
        >
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle>PDF Preview</DialogTitle>
            {pdfTabs.length > 1 && (
              <Tabs 
                defaultValue={pdfTabs[0].url} 
                value={activePdf} 
                onValueChange={(value) => {
                  setActivePdf(value);
                  setActiveTabIndex(pdfTabs.findIndex(tab => tab.url === value));
                }}
                className="mt-6"
              >
                <TabsList className="w-full justify-start overflow-x-auto">
                  {pdfTabs.map((tab, index) => (
                    <TabsTrigger 
                      key={index} 
                      value={tab.url}
                      className="whitespace-nowrap"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </DialogHeader>
          <div className="flex-grow overflow-auto p-4">
            {activePdf && <PdfFrame url={activePdf} />}
          </div>
          <div id="pdf-dialog-description" className="sr-only">
            PDF viewer with interactive tabs for viewing multiple documents
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 