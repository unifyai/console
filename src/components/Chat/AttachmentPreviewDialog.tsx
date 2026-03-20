'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
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
} from './attachmentUtils';
import type { Attachment, AttachmentType } from '@/types/assistants/chat';

const PREVIEWABLE_TYPES: Set<AttachmentType> = new Set(['image', 'pdf', 'text', 'code']);
const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024; // 1MB

type ContentState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'text'; content: string }
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
          const url = await getSignedUrl(attachment.gsUrl, false);
          const res = await fetch(url);
          const text = await res.text();
          if (!cancelled) setState({ status: 'text', content: text });
        } else {
          setState({ status: 'unsupported' });
        }
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
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Failed to load preview' });
      }
    });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [attachment]);

  return state;
}

function PreviewViewer({ attachment, content }: { attachment: Attachment; content: ContentState }) {
  const type = getAttachmentType(attachment.filename);
  const Icon = getAttachmentIcon(type);
  const iconColor = getAttachmentColor(type);

  if (content.status === 'loading') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
      <pre className="styled-scrollbar max-h-[75vh] overflow-auto rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed">
        {content.content}
      </pre>
    );
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate">{attachment.filename}</DialogTitle>
              <DialogDescription>
                {formatFileSize(attachment.sizeBytes ?? 0)}
              </DialogDescription>
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
        <PreviewViewer attachment={attachment} content={content} />
      </DialogContent>
    </Dialog>
  );
}
