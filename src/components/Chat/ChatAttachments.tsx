import * as React from 'react';
import { X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/UI/badge';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  getAttachmentType,
  getAttachmentIcon,
  getAttachmentColor,
  truncateFilename,
  formatFileSize,
  getSignedUrl,
  isHtmlAttachment,
} from './attachmentUtils';
import { HtmlAttachmentEmbed } from './HtmlAttachmentEmbed';
import type { Attachment } from '@/types/assistants/chat';

// =============================================================================
// ATTACHMENT CHIP
// =============================================================================

export interface AttachmentChipProps {
  attachment: Attachment;
  onRemove?: () => void;
  className?: string;
}

/**
 * Single attachment chip with icon, filename, and optional remove button.
 * When the attachment has a gsUrl, clicking the chip triggers a download.
 */
export function AttachmentChip({ attachment, onRemove, className }: AttachmentChipProps) {
  const [downloading, setDownloading] = React.useState(false);
  const type = getAttachmentType(attachment.filename);
  const Icon = getAttachmentIcon(type);
  const iconColor = getAttachmentColor(type);
  const truncatedName = truncateFilename(attachment.filename);
  const showRemoveButton = !!onRemove;
  const isDownloadable = !!attachment.gsUrl;

  const handleDownload = React.useCallback(async () => {
    if (!attachment.gsUrl || downloading) return;
    setDownloading(true);
    try {
      const signedUrl = await getSignedUrl(attachment.gsUrl, true, attachment.filename);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = attachment.filename;
      link.click();
    } catch (error) {
      console.error(`Failed to download ${attachment.filename}:`, error);
    } finally {
      setDownloading(false);
    }
  }, [attachment.gsUrl, attachment.filename, downloading]);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              'text-body border-border/60 group flex items-center gap-1.5 border bg-transparent px-2.5 py-1',
              isDownloadable && 'hover:bg-muted/50 cursor-pointer',
              className
            )}
            data-testid="attachment-chip"
            onClick={isDownloadable ? handleDownload : undefined}
            role={isDownloadable ? 'button' : undefined}
          >
            <Icon
              className="h-3.5 w-3.5 flex-shrink-0"
              style={{ color: iconColor }}
              data-testid="attachment-icon"
            />
            <span className="truncate" data-testid="attachment-name">
              {truncatedName}
            </span>
            {isDownloadable && !showRemoveButton && (
              <Download className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            )}
            {showRemoveButton && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-0.5 h-4 w-4 rounded-full p-0 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                aria-label={`Remove ${attachment.filename}`}
                data-testid="attachment-remove"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-caption space-y-0.5">
            <p className="font-medium">{attachment.filename}</p>
            <p className="text-muted-foreground">{formatFileSize(attachment.sizeBytes ?? 0)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// PENDING ATTACHMENT LIST (above input, with remove buttons)
// =============================================================================

export interface PendingAttachmentListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  className?: string;
}

/**
 * List of pending attachments above the input area.
 * Shows remove buttons for each chip.
 */
export function PendingAttachmentList({
  attachments,
  onRemove,
  className,
}: PendingAttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)} data-testid="pending-attachments">
      {attachments.map((attachment) => (
        <div key={attachment.id} data-testid="pending-attachment-chip">
          <AttachmentChip attachment={attachment} onRemove={() => onRemove(attachment.id)} />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MESSAGE ATTACHMENT LIST (in sent message bubble, no remove buttons)
// =============================================================================

export interface MessageAttachmentListProps {
  attachments: Attachment[];
  isAssistant?: boolean;
  className?: string;
}

/**
 * List of attachments displayed in a sent message bubble.
 * When `isAssistant` is true, HTML attachments render as inline iframe previews.
 */
export function MessageAttachmentList({
  attachments,
  isAssistant,
  className,
}: MessageAttachmentListProps) {
  if (attachments.length === 0) return null;

  const htmlAttachments = isAssistant ? attachments.filter(isHtmlAttachment) : [];
  const otherAttachments = isAssistant
    ? attachments.filter((a) => !isHtmlAttachment(a))
    : attachments;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {htmlAttachments.map((attachment) => (
        <HtmlAttachmentEmbed key={attachment.id} attachment={attachment} />
      ))}
      {otherAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {otherAttachments.map((attachment) => (
            <div key={attachment.id} data-testid="message-attachment">
              <AttachmentChip attachment={attachment} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
