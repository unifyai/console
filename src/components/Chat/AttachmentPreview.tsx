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
import type { Attachment } from '@/types/assistants/chat';

// =============================================================================
// TYPES
// =============================================================================

type SignedUrlState =
  | { status: 'loading' }
  | { status: 'available'; url: string }
  | { status: 'unavailable' };

export interface AttachmentPreviewProps {
  /** Attachment with gsUrl for on-demand signed URL generation */
  attachment: Attachment;
  /** Optional additional CSS classes */
  className?: string;
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
  const type = getAttachmentType(attachment.filename);
  const isImageType = attachment.contentType?.startsWith('image/') || type === 'image';

  useEffect(() => {
    let cancelled = false;

    async function fetchSignedUrl() {
      if (!attachment.gsUrl) {
        setUrlState({ status: 'unavailable' });
        return;
      }

      try {
        const signedUrl = await getSignedUrl(attachment.gsUrl, true, attachment.filename);
        if (!cancelled) {
          setUrlState({ status: 'available', url: signedUrl });
        }
      } catch (error) {
        console.error(`Failed to get signed URL for ${attachment.filename}:`, error);
        if (!cancelled) {
          setUrlState({ status: 'unavailable' });
        }
      }
    }

    fetchSignedUrl();

    return () => {
      cancelled = true;
    };
  }, [attachment.gsUrl, attachment.filename]);

  const Icon = getAttachmentIcon(type);
  const iconColor = getAttachmentColor(type);

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
        aria-label={`Loading ${attachment.filename}`}
        title={attachment.filename}
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
        title={`${attachment.filename} - File unavailable`}
      >
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  // Available - render based on type
  const { url } = urlState;

  // Image attachment - show constant-size thumbnail, click to download
  if (isImageType) {
    return (
      <a
        href={url}
        download={attachment.filename}
        className={cn(
          'group relative block h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg',
          className
        )}
        data-testid="attachment-preview-image"
        title={attachment.filename}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.filename}
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
      download={attachment.filename}
      className={cn(
        'bg-muted/50 group flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted',
        className
      )}
      data-testid="attachment-preview-document"
      title={`${attachment.filename}${attachment.sizeBytes ? ` (${formatFileSize(attachment.sizeBytes)})` : ''}`}
    >
      <Icon className="h-5 w-5" style={{ color: iconColor }} data-testid="file-icon" />
    </a>
  );
}

export default AttachmentPreview;
