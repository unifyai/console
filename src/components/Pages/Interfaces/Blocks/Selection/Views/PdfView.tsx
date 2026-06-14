'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LogComparisonProps } from './types';
import RowBadge from './RowBadge';
import MarkdownRenderer from './Markdown/MarkdownRenderer';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/UI/dialog';
import { AlertCircle, ExternalLink, FileText } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Tabs, TabsList, TabsTrigger } from '@/components/UI/tabs';
import ActionButton from '@/components/Common/Buttons/Action';

/**
 * Determine if the string represents a valid PDF URL or path
 */
function isNonEmptyPdf(value: string) {
  return typeof value === 'string' && value.trim() !== '';
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
      const ver = idx >= 0 ? compVers[idx] : '';
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
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Reset error and loading state when URL changes
    setHasError(false);
    setIsLoading(true);

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
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="mb-4 h-10 w-10 text-[color:var(--status-warning)]" />
        <h3 className="text-title mb-2">Content Security Policy Restriction</h3>
        <p className="mb-4">
          This PDF cannot be embedded due to security restrictions set by the website.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-primary/90 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Open PDF in New Tab <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="bg-background/80 absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader size={32} />
            <p className="text-body text-muted-foreground">Loading PDF...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        className="h-full w-full border-none"
        title="PDF Preview"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </div>
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
function OpenInNewTabButton({ url, className }: { url: string; className?: string }) {
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
  diffMode = 'none',
  splitView = false,
  version = '',
  comparableVersions = [],
}: LogComparisonProps) {
  const singleMode = !comparables || comparables.length === 0;
  const baseUrl = String(value ?? '');
  const compUrls = (comparables ?? []).map((c) => String(c ?? ''));
  const baseVersion = version || '';
  const compVers = comparableVersions || [];
  const versionEmpty = !baseVersion && compVers.every((v) => !v);

  // State for PDF dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activePdf, setActivePdf] = useState<string>('');

  // New state for multi-tab PDF viewer
  const [pdfTabs, setPdfTabs] = useState<PdfTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

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

  // Extract filename for display
  const fileName = getPdfFilename(baseUrl);

  // Handler for opening the multi-tab PDF viewer - moved outside conditional
  const handleView = useCallback(() => {
    // Setup tab info
    const tab = { url: baseUrl, label: fileName || 'PDF' };
    setPdfTabs([tab]);
    setActivePdf(baseUrl);
    setActiveTabIndex(0);

    // Open dialog
    setDialogOpen(true);
  }, [baseUrl, fileName]);

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

  // Helper to create the PDF URL display with inspect and copy buttons
  const PdfUrlDisplay = ({ url, label }: { url: string; label?: string }) => (
    <div className="text-body break-all">
      <a
        onClick={() => openPdf(url, label)}
        className="cursor-pointer text-primary hover:underline"
      >
        {url}
      </a>
    </div>
  );

  // New component: Button to view multiple PDFs
  const ViewMultiplePdfsButton = ({ pdfs }: { pdfs: { url: string; label: string }[] }) => {
    if (pdfs.length === 0) return null;

    return (
      <button
        onClick={() => openMultiplePdfs(pdfs)}
        className="bg-primary/10 hover:bg-primary/20 text-body group mt-4 flex items-center gap-2 rounded-md px-3 py-1.5 text-primary transition-colors"
      >
        <FileText className="h-4 w-4" />
        <span className="group-hover:underline">View all Selected PDFs</span>
      </button>
    );
  };

  // SINGLE MODE: Just the base PDF
  if (singleMode) {
    const hasPdf = isNonEmptyPdf(baseUrl);

    if (!hasPdf) {
      return (
        <div className="p-3">
          <div className="rounded border p-2">
            <p className="text-body italic text-muted-foreground">No PDF</p>
          </div>
        </div>
      );
    }

    // For single mode, just set up a direct View button
    return (
      <div className="p-3">
        <div className="group relative rounded border p-2">
          <div className="flex-grow pr-16">
            <PdfUrlDisplay url={baseUrl} />
          </div>
          <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <OpenInNewTabButton url={baseUrl} />
            <CopyButton content={baseUrl} copyMessage="Copied URL!" tooltipContent="Copy URL" />
          </div>
        </div>

        {/* PDF Dialog with tabs */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="flex h-[90vh] w-full max-w-full flex-col p-0"
            aria-describedby="pdf-dialog-description"
          >
            <DialogHeader className="shrink-0 border-b p-4">
              <DialogTitle>PDF Preview</DialogTitle>
              <DialogDescription id="pdf-dialog-description" className="sr-only">
                PDF viewer with interactive tabs for viewing multiple documents
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-auto p-4">
              {activePdf && <PdfFrame url={activePdf} />}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // MULTIPLE MODE: Treat all PDFs in no diff mode
  // Group identical PDF URLs across base + comps
  const allVals = [baseUrl, ...compUrls];
  const rowIndices = [baseLogIndex, ...comparisonLogsIndex];
  const grouped = groupPdfsByValue(allVals, rowIndices);

  // Filter out empties
  const filtered = grouped.filter((g) => isNonEmptyPdf(g.pdfUrl));

  // Create a list of all unique PDFs for multi-view
  const allPdfs = filtered.map((group) => ({
    url: group.pdfUrl,
    label: `PDF (${group.rows.length === 1 ? 'Row' : 'Rows'} ${group.rows.map((r) => r + 1).join(', ')})`,
  }));

  return (
    <div className="space-y-4">
      {/* Move the "View All PDFs" button to the top */}
      {filtered.length > 1 && <ViewMultiplePdfsButton pdfs={allPdfs} />}

      {filtered.map((group, idx) => {
        const { pdfUrl, rows } = group;
        // Group by version
        const verGroups = groupVersionsForRows(
          rows,
          baseLogIndex,
          baseVersion,
          comparisonLogsIndex,
          compVers
        );

        return (
          <div key={idx} className="space-y-4 p-3">
            {!versionEmpty && (
              <>
                <p className="text-title">Version</p>
                <div className="space-y-2">
                  {verGroups.map((vg, j) => (
                    <div key={j} className="group relative rounded border p-2">
                      <RowBadge rowNumbers={vg.rows} mode="none" />
                      {vg.versionText ? (
                        <div className="pt-4">
                          <MarkdownRenderer>{vg.versionText}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="text-body pt-2 italic text-muted-foreground">No version</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* The PDF link */}
            <div className="space-y-2">
              {!versionEmpty && <p className="text-title">PDF</p>}
              <div className="group relative rounded border p-2">
                <RowBadge rowNumbers={rows} mode="none" />
                <div className="mt-3 pr-16">
                  <PdfUrlDisplay url={pdfUrl} />
                </div>
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
          className="flex h-[90vh] w-full max-w-full flex-col p-0"
          aria-describedby="pdf-dialog-description"
        >
          <DialogHeader className="shrink-0 border-b p-4">
            <DialogTitle>PDF Preview</DialogTitle>
            <DialogDescription id="pdf-dialog-description" className="sr-only">
              PDF viewer with interactive tabs for viewing multiple documents
            </DialogDescription>
            {pdfTabs.length > 1 && (
              <Tabs
                defaultValue={pdfTabs[0].url}
                value={activePdf}
                onValueChange={(value) => {
                  setActivePdf(value);
                  setActiveTabIndex(pdfTabs.findIndex((tab) => tab.url === value));
                }}
                className="mt-6"
              >
                <TabsList className="w-full justify-start overflow-x-auto">
                  {pdfTabs.map((tab, index) => (
                    <TabsTrigger key={index} value={tab.url} className="whitespace-nowrap">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
