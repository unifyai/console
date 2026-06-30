'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, FileCode, Maximize2, Minimize2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { getSignedUrl, truncateFilename } from './attachmentUtils';
import { AttachmentChip } from './ChatAttachments';
import type { Attachment } from '@/types/assistants/chat';

async function fetchHtmlContent(gsUrl: string): Promise<string> {
  const res = await fetch('/api/storage/html-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
    body: JSON.stringify({ gs_url: gsUrl }),
  });
  if (!res.ok) throw new Error('Failed to fetch HTML content');
  const data = await res.json();
  return data.html;
}

interface HtmlAttachmentEmbedProps {
  attachment: Attachment;
  defaultHeight?: number;
  className?: string;
}

export function HtmlAttachmentEmbed({
  attachment,
  defaultHeight = 400,
  className,
}: HtmlAttachmentEmbedProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!attachment.gsUrl) {
      setError(true);
      return;
    }
    let cancelled = false;
    fetchHtmlContent(attachment.gsUrl)
      .then((html) => {
        if (!cancelled) setHtmlContent(html);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.gsUrl]);

  useEffect(() => {
    if (!attachment.gsUrl) return;
    let cancelled = false;
    getSignedUrl(attachment.gsUrl, false)
      .then((url) => {
        if (!cancelled) setSignedUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [attachment.gsUrl]);

  useEffect(() => {
    if (!isInteractive) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsInteractive(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isInteractive]);

  useEffect(() => {
    if (!isInteractive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsInteractive(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isInteractive]);

  const handleOpenInNewTab = useCallback(() => {
    if (signedUrl) window.open(signedUrl, '_blank', 'noopener,noreferrer');
  }, [signedUrl]);

  const handleDownload = useCallback(async () => {
    if (!attachment.gsUrl) return;
    const downloadUrl = await getSignedUrl(attachment.gsUrl, true, attachment.filename);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = attachment.filename;
    link.click();
  }, [attachment.gsUrl, attachment.filename]);

  if (error || !attachment.gsUrl) {
    return <AttachmentChip attachment={attachment} />;
  }

  if (!htmlContent) {
    return (
      <div
        className={cn(
          'my-2 overflow-hidden rounded-lg border border-border bg-background',
          className
        )}
      >
        <div className="bg-muted/30 flex items-center gap-2 border-b border-border px-3 py-2">
          <FileCode className="h-4 w-4 text-primary" />
          <span className="text-title">{truncateFilename(attachment.filename, 40)}</span>
        </div>
        <div
          style={{ height: defaultHeight }}
          className="flex items-center justify-center text-muted-foreground"
        >
          <span className="text-caption">Loading preview...</span>
        </div>
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <div
        className={cn(
          'bg-muted/30 hover:bg-muted/50 group my-2 flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 transition-colors',
          className
        )}
      >
        <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <FileCode className="h-4 w-4 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-title text-foreground">
            {truncateFilename(attachment.filename, 40)}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="h-8 w-8 p-0"
            title="Expand inline"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenInNewTab}
            className="h-8 w-8 p-0"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'my-2 overflow-hidden rounded-lg border border-border bg-background shadow-sm',
        className
      )}
    >
      <div className="bg-muted/30 flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-primary" />
          <span className="text-title">{truncateFilename(attachment.filename, 40)}</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 w-7 p-0"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenInNewTab}
            className="h-7 w-7 p-0"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsExpanded(false);
              setIsInteractive(false);
            }}
            className="h-7 w-7 p-0"
            title="Collapse"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div style={{ height: defaultHeight }} className="relative">
        <iframe
          srcDoc={htmlContent}
          className={cn('h-full w-full border-0', !isInteractive && 'pointer-events-none')}
          title={attachment.filename}
          sandbox="allow-scripts allow-popups"
        />
        {!isInteractive && (
          <div
            className="absolute inset-0 flex cursor-pointer items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
            onClick={() => setIsInteractive(true)}
          >
            <span className="text-label bg-card/95 rounded-md border border-border px-3 py-1.5 text-foreground opacity-0 shadow-pop transition-opacity [div:hover>&]:opacity-100">
              Click to interact
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
