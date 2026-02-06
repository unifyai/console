'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAttachmentType,
  getAttachmentIcon,
  getAttachmentColor,
  formatFileSize,
  getSignedUrl,
} from './attachmentUtils';
import type { MessageAttachment, ChatAttachment, AttachmentType } from '@/types/assistants/chat';

// =============================================================================
// TYPES
// =============================================================================

type SignedUrlState =
  | { status: 'loading' }
  | { status: 'available'; url: string }
  | { status: 'unavailable' };

export interface AttachmentPreviewProps {
  /** Attachment with gsUrl for on-demand signed URL generation */
  attachment: MessageAttachment | ChatAttachment;
  /** Optional additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPER: Get attachment details from either type
// =============================================================================

function getAttachmentDetails(attachment: MessageAttachment | ChatAttachment): {
  id: string;
  filename: string;
  gsUrl: string | undefined;
  contentType: string | undefined;
  sizeBytes: number | undefined;
  type: AttachmentType;
} {
  // MessageAttachment uses 'filename', ChatAttachment uses 'name'
  const filename = 'filename' in attachment ? attachment.filename : attachment.name;
  const gsUrl = attachment.gsUrl;
  const contentType = attachment.contentType;
  const sizeBytes = attachment.sizeBytes;
  const type = getAttachmentType(filename);

  return { id: attachment.id, filename, gsUrl, contentType, sizeBytes, type };
}

// =============================================================================
// ATTACHMENT PREVIEW COMPONENT
// =============================================================================

/**
 * Displays a historical message attachment with on-demand signed URL generation.
 *
 * Features:
 * - Shows loading state while fetching signed URL
 * - Displays image thumbnails for image attachments
 * - Shows file icon + download link for documents
 * - Gracefully handles unavailable files (deleted or errors)
 */
export function AttachmentPreview({ attachment, className }: AttachmentPreviewProps) {
  const [urlState, setUrlState] = useState<SignedUrlState>({ status: 'loading' });
  const details = getAttachmentDetails(attachment);

  useEffect(() => {
    let cancelled = false;

    async function fetchSignedUrl() {
      if (!details.gsUrl) {
        setUrlState({ status: 'unavailable' });
        return;
      }

      try {
        const signedUrl = await getSignedUrl(details.gsUrl);
        if (!cancelled) {
          setUrlState({ status: 'available', url: signedUrl });
        }
      } catch (error) {
        console.error(`Failed to get signed URL for ${details.filename}:`, error);
        if (!cancelled) {
          setUrlState({ status: 'unavailable' });
        }
      }
    }

    fetchSignedUrl();

    return () => {
      cancelled = true;
    };
  }, [details.gsUrl, details.filename]);

  const Icon = getAttachmentIcon(details.type);
  const iconColor = getAttachmentColor(details.type);
  const isImage = details.contentType?.startsWith('image/') || details.type === 'image';

  // Loading state - show as thumbnail-sized placeholder
  if (urlState.status === 'loading') {
    return (
      <div
        className={cn(
          'bg-muted/50 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg',
          className
        )}
        data-testid="attachment-preview-loading"
        role="status"
        aria-label={`Loading ${details.filename}`}
        title={details.filename}
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unavailable state (file deleted or error)
  if (urlState.status === 'unavailable') {
    return (
      <div
        className={cn(
          'bg-muted/30 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg opacity-60',
          className
        )}
        data-testid="attachment-preview-unavailable"
        title={`${details.filename} - File unavailable`}
      >
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  // Available - render based on type
  const { url } = urlState;

  // Image attachment - show constant-size thumbnail
  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group relative block h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg',
          className
        )}
        data-testid="attachment-preview-image"
        title={details.filename}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={details.filename}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-110"
        />
      </a>
    );
  }

  // Document attachment - show as thumbnail-sized icon
  return (
    <a
      href={url}
      download={details.filename}
      className={cn(
        'bg-muted/50 group flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted',
        className
      )}
      data-testid="attachment-preview-document"
      title={`${details.filename}${details.sizeBytes ? ` (${formatFileSize(details.sizeBytes)})` : ''}`}
    >
      <Icon className="h-5 w-5" style={{ color: iconColor }} data-testid="file-icon" />
    </a>
  );
}

// =============================================================================
// HISTORICAL ATTACHMENT LIST
// =============================================================================

export interface HistoricalAttachmentListProps {
  /** List of attachments from transcript history */
  attachments: (MessageAttachment | ChatAttachment)[];
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * List of historical attachments displayed in a message from transcript history.
 * Each attachment fetches its signed URL on-demand for display.
 */
export function HistoricalAttachmentList({
  attachments,
  className,
}: HistoricalAttachmentListProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)} data-testid="historical-attachments">
      {attachments.map((attachment) => (
        <AttachmentPreview key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

export default AttachmentPreview;
