'use client';

import * as React from 'react';
import { Download, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/UI/dialog';
import {
  getAttachmentType,
  getAttachmentIcon,
  getAttachmentColor,
  formatFileSize,
  getSignedUrl,
  fetchGcsContent,
} from './attachmentUtils';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { pptxToHtml } from '@jvmr/pptx-to-html';
import { Badge } from '@/components/UI/badge';
import type { Attachment, AttachmentType } from '@/types/assistants/chat';

const PREVIEWABLE_TYPES = new Set<AttachmentType>([
  'image',
  'pdf',
  'text',
  'code',
  'word',
  'excel',
  'powerpoint',
]);

function worksheetToHtml(ws: ExcelJS.Worksheet): string {
  const rows: string[] = [];
  ws.eachRow((row) => {
    const cells = (row.values as ExcelJS.CellValue[])
      .slice(1) // ExcelJS rows are 1-indexed; index 0 is empty
      .map((v) => `<td>${v != null ? String(v) : ''}</td>`)
      .join('');
    rows.push(`<tr>${cells}</tr>`);
  });
  return `<table>${rows.join('')}</table>`;
}
const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024; // 1MB

interface ExcelSheet {
  name: string;
  html: string;
}

type ContentState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'text'; content: string }
  | { status: 'html'; content: string }
  | { status: 'excel'; sheets: ExcelSheet[] }
  | { status: 'slides'; slides: string[] }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

function usePreviewContent(attachment: Attachment | null): ContentState {
  const [state, setState] = React.useState<ContentState>({ status: 'loading' });
  const prevIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!attachment) {
      setState({ status: 'loading' });
      prevIdRef.current = null;
      return;
    }

    if (attachment.id === prevIdRef.current) return;
    prevIdRef.current = attachment.id;
    setState({ status: 'loading' });

    const type = getAttachmentType(attachment.filename);

    if (!PREVIEWABLE_TYPES.has(type)) {
      setState({ status: 'unsupported' });
      return;
    }

    let cancelled = false;
    let blobUrl: string | null = null;

    const resolve = async () => {
      // Text/code: read as string
      if (type === 'text' || type === 'code') {
        if (attachment.file) {
          if (attachment.file.size > TEXT_PREVIEW_MAX_BYTES) {
            setState({ status: 'error', message: 'File too large to preview as text' });
            return;
          }
          const text = await attachment.file.text();
          if (!cancelled) setState({ status: 'text', content: text });
        } else if (attachment.gsUrl) {
          const buf = await fetchGcsContent(attachment.gsUrl);
          const text = new TextDecoder().decode(buf);
          if (!cancelled) setState({ status: 'text', content: text });
        } else {
          setState({ status: 'unsupported' });
        }
        return;
      }

      // Word documents (.docx only — .doc/.odt lack viable browser libraries)
      if (type === 'word') {
        const ext = attachment.filename.split('.').pop()?.toLowerCase();
        if (ext !== 'docx') {
          setState({ status: 'unsupported' });
          return;
        }

        let arrayBuffer: ArrayBuffer;
        if (attachment.file) {
          arrayBuffer = await attachment.file.arrayBuffer();
        } else if (attachment.gsUrl) {
          arrayBuffer = await fetchGcsContent(attachment.gsUrl);
        } else {
          setState({ status: 'unsupported' });
          return;
        }

        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setState({ status: 'html', content: result.value });
        return;
      }

      // Excel/spreadsheet: parse with SheetJS and convert each sheet to HTML
      if (type === 'excel') {
        let arrayBuffer: ArrayBuffer;
        if (attachment.file) {
          arrayBuffer = await attachment.file.arrayBuffer();
        } else if (attachment.gsUrl) {
          arrayBuffer = await fetchGcsContent(attachment.gsUrl);
        } else {
          setState({ status: 'unsupported' });
          return;
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const sheets: ExcelSheet[] = workbook.worksheets.map((ws) => ({
          name: ws.name,
          html: worksheetToHtml(ws),
        }));

        if (!cancelled) setState({ status: 'excel', sheets });
        return;
      }

      // PowerPoint (.pptx only — .ppt/.odp lack viable browser libraries)
      if (type === 'powerpoint') {
        const ext = attachment.filename.split('.').pop()?.toLowerCase();
        if (ext !== 'pptx') {
          setState({ status: 'unsupported' });
          return;
        }

        let arrayBuffer: ArrayBuffer;
        if (attachment.file) {
          arrayBuffer = await attachment.file.arrayBuffer();
        } else if (attachment.gsUrl) {
          arrayBuffer = await fetchGcsContent(attachment.gsUrl);
        } else {
          setState({ status: 'unsupported' });
          return;
        }

        const slides = await pptxToHtml(arrayBuffer);
        if (!cancelled) setState({ status: 'slides', slides });
        return;
      }

      // Image/PDF: resolve to a URL
      if (attachment.file) {
        // Re-wrap with correct MIME type for PDFs — some browsers infer
        // the wrong type from the File object, breaking the PDF viewer.
        if (type === 'pdf') {
          const blob = new Blob([attachment.file], { type: 'application/pdf' });
          blobUrl = URL.createObjectURL(blob);
        } else {
          blobUrl = URL.createObjectURL(attachment.file);
        }
        if (!cancelled) setState({ status: 'ready', url: blobUrl });
      } else if (attachment.gsUrl) {
        const url = await getSignedUrl(attachment.gsUrl, false);
        if (!cancelled) setState({ status: 'ready', url });
      } else {
        setState({ status: 'unsupported' });
      }
    };

    resolve().catch((err) => {
      if (!cancelled) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to load preview',
        });
      }
    });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [attachment]);

  return state;
}

function ExcelViewer({ sheets }: { sheets: ExcelSheet[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <div className="flex max-h-[75vh] min-w-0 flex-col">
      {sheets.length > 1 && (
        <div className="mb-2 flex gap-1 border-b border-border pb-2">
          {sheets.map((sheet, i) => (
            <Badge
              key={sheet.name}
              variant={i === activeIndex ? 'default' : 'secondary'}
              className={cn(
                'cursor-pointer text-xs',
                i === activeIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/80 bg-muted'
              )}
              onClick={() => setActiveIndex(i)}
            >
              {sheet.name}
            </Badge>
          ))}
        </div>
      )}
      <div
        className="styled-scrollbar attachment-spreadsheet min-w-0 flex-1 overflow-auto rounded-md"
        dangerouslySetInnerHTML={{ __html: sheets[activeIndex]?.html ?? '' }}
      />
    </div>
  );
}

function buildSlideDoc(slideHtml: string): string {
  return `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;background:var(--background);}</style></head><body>${slideHtml}</body></html>`;
}

function SlidesViewer({ slides }: { slides: string[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => Math.min(slides.length - 1, i + 1));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [slides.length]);

  return (
    <div className="flex flex-col gap-2">
      <iframe
        srcDoc={buildSlideDoc(slides[activeIndex] ?? '')}
        title={`Slide ${activeIndex + 1}`}
        className="w-full rounded-md border border-border"
        style={{ aspectRatio: '16 / 9', maxHeight: '65vh' }}
        sandbox="allow-same-origin"
      />
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((i) => i - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-caption text-muted-foreground">
            Slide {activeIndex + 1} of {slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activeIndex === slides.length - 1}
            onClick={() => setActiveIndex((i) => i + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function PreviewViewer({ attachment, content }: { attachment: Attachment; content: ContentState }) {
  const type = getAttachmentType(attachment.filename);
  const Icon = getAttachmentIcon(type);
  const iconColor = getAttachmentColor(type);

  if (content.status === 'loading') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader size={24} />
      </div>
    );
  }

  if (content.status === 'error') {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Icon className="h-10 w-10" style={{ color: iconColor }} />
        <p className="text-caption">{content.message}</p>
      </div>
    );
  }

  if (content.status === 'unsupported') {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Icon className="h-10 w-10" style={{ color: iconColor }} />
        <p className="text-caption">Preview not available for this file type</p>
      </div>
    );
  }

  if (content.status === 'text') {
    return (
      <pre className="styled-scrollbar bg-muted/50 text-caption max-h-[75vh] overflow-auto rounded-md p-4 font-mono leading-relaxed">
        {content.content}
      </pre>
    );
  }

  if (content.status === 'html') {
    return (
      <div
        className="styled-scrollbar attachment-prose bg-muted/50 max-h-[75vh] overflow-auto rounded-md p-6"
        dangerouslySetInnerHTML={{ __html: content.content }}
      />
    );
  }

  if (content.status === 'excel') {
    return <ExcelViewer sheets={content.sheets} />;
  }

  if (content.status === 'slides') {
    return <SlidesViewer slides={content.slides} />;
  }

  // content.status === 'ready' — image or PDF URL
  if (type === 'image') {
    return (
      <div className="flex max-h-[75vh] items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={content.url}
          alt={attachment.filename}
          className="max-h-[75vh] max-w-full object-contain"
        />
      </div>
    );
  }

  if (type === 'pdf') {
    return (
      <iframe
        src={`${content.url}#toolbar=1&view=FitH`}
        title={attachment.filename}
        className="h-[75vh] w-full rounded-md border-0"
      />
    );
  }

  return null;
}

export interface AttachmentPreviewDialogProps {
  attachment: Attachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
}: AttachmentPreviewDialogProps) {
  const content = usePreviewContent(open ? attachment : null);

  const handleDownload = React.useCallback(async () => {
    if (!attachment) return;

    if (attachment.file) {
      const url = URL.createObjectURL(attachment.file);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      link.click();
      URL.revokeObjectURL(url);
    } else if (attachment.gsUrl) {
      const url = await getSignedUrl(attachment.gsUrl, true, attachment.filename);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      link.click();
    }
  }, [attachment]);

  if (!attachment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate">{attachment.filename}</DialogTitle>
              <DialogDescription>{formatFileSize(attachment.sizeBytes ?? 0)}</DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 gap-1.5"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </DialogHeader>
        {(content.status === 'html' ||
          content.status === 'excel' ||
          content.status === 'slides') && (
          <div className="bg-muted/50 text-caption flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            Simplified preview — download and open in native application for full quality.
          </div>
        )}
        <PreviewViewer attachment={attachment} content={content} />
      </DialogContent>
    </Dialog>
  );
}
