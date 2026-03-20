import * as React from 'react';
import { X, Download, ChevronDown, ChevronUp, Loader2, Check, AlertCircle, Clock } from 'lucide-react';
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
  isOversized,
} from './attachmentUtils';
import { HtmlAttachmentEmbed } from './HtmlAttachmentEmbed';
import type { Attachment } from '@/types/assistants/chat';

const COLLAPSED_CHIP_LIMIT = 5;

/**
 * Derive a summary upload status icon for a set of hidden chips.
 * Shows the least-progressed state: queued > uploading > done.
 * Returns null if no chips have an upload status.
 */
function hiddenStatusIcon(items: Attachment[]): React.ReactNode {
  const statuses = items.map((a) => a.uploadStatus).filter(Boolean);
  if (statuses.length === 0) return null;
  if (statuses.includes('queued'))
    return <Clock className="h-3 w-3 flex-shrink-0 text-muted-foreground/50" />;
  if (statuses.includes('uploading'))
    return <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground" />;
  if (statuses.includes('error'))
    return <AlertCircle className="h-3 w-3 flex-shrink-0 text-destructive" />;
  if (statuses.every((s) => s === 'done'))
    return <Check className="h-3 w-3 flex-shrink-0 text-green-500" />;
  return null;
}

// =============================================================================
// ATTACHMENT CHIP
// =============================================================================

export interface AttachmentChipProps {
  attachment: Attachment;
  onRemove?: () => void;
  onHover?: (attachment: Attachment | null) => void;
  className?: string;
}

/**
 * Single attachment chip with icon, filename, and optional remove button.
 * When the attachment has a gsUrl, clicking the chip triggers a download.
 * During upload, shows a spinner/check/error indicator instead of remove.
 */
export function AttachmentChip({ attachment, onRemove, onHover, className }: AttachmentChipProps) {
  const [downloading, setDownloading] = React.useState(false);
  const type = getAttachmentType(attachment.filename);
  const Icon = getAttachmentIcon(type);
  const iconColor = getAttachmentColor(type);
  const truncatedName = truncateFilename(attachment.filename);
  const isDownloadable = !!attachment.gsUrl;
  const status = attachment.uploadStatus;
  const isUploading = status === 'queued' || status === 'uploading' || status === 'done' || status === 'error';
  const tooLarge = isOversized(attachment.sizeBytes);

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

  const statusIndicator = React.useMemo(() => {
    const iconWithTooltip = (icon: React.ReactNode, label: string) => (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{icon}</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span className="text-caption font-medium">{label}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    switch (status) {
      case 'queued':
        return iconWithTooltip(<Clock className="h-3 w-3 flex-shrink-0 text-muted-foreground/50" />, 'Queued');
      case 'uploading':
        return iconWithTooltip(<Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground" />, 'Uploading');
      case 'done':
        return iconWithTooltip(<Check className="h-3 w-3 flex-shrink-0 text-green-500" />, 'Uploaded');
      case 'error':
        return iconWithTooltip(<AlertCircle className="h-3 w-3 flex-shrink-0 text-destructive" />, 'Failed');
      default:
        return null;
    }
  }, [status]);

  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-body border-border/60 group flex items-center gap-1.5 border bg-transparent px-2.5 py-1',
        isDownloadable && 'hover:bg-muted/50 cursor-pointer',
        status === 'error' && 'border-destructive/40',
        tooLarge && 'border-destructive bg-destructive/10',
        className
      )}
      data-testid="attachment-chip"
      onClick={isDownloadable ? handleDownload : undefined}
      role={isDownloadable ? 'button' : undefined}
      onMouseEnter={() => onHover?.(attachment)}
      onMouseLeave={() => onHover?.(null)}
    >
      {tooLarge ? (
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-destructive" data-testid="attachment-icon" />
      ) : (
        <Icon
          className={cn('h-3.5 w-3.5 flex-shrink-0', (status === 'uploading' || status === 'queued') && 'opacity-50')}
          style={{ color: iconColor }}
          data-testid="attachment-icon"
        />
      )}
      <span className={cn('truncate', (status === 'uploading' || status === 'queued') && 'opacity-50')} data-testid="attachment-name">
        {truncatedName}
      </span>
      {statusIndicator}
      {!isUploading && isDownloadable && !onRemove && (
        <Download className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      )}
      {!isUploading && onRemove && (
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
  );
}

// =============================================================================
// INLINE HOVER LABEL (appears at the end of the chip flow)
// =============================================================================

function HoverLabel({ attachment }: { attachment: Attachment | null }) {
  if (!attachment) return null;

  const tooLarge = isOversized(attachment.sizeBytes);
  const sizeText = formatFileSize(attachment.sizeBytes ?? 0);

  return (
    <span className={cn(
      'text-caption absolute -top-5 left-0 whitespace-nowrap',
      tooLarge ? 'text-destructive' : 'text-muted-foreground'
    )}>
      {attachment.filename} [{sizeText}]{tooLarge && ' → Too large, will be dropped on send.'}
    </span>
  );
}

// =============================================================================
// PENDING ATTACHMENT LIST (above input, with remove buttons)
// =============================================================================

export interface PendingAttachmentListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  onRemoveAll?: () => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * List of pending attachments above the input area.
 * Shows remove buttons for each chip. Beyond COLLAPSED_CHIP_LIMIT files,
 * collapses into a "+N more" badge that expands on click.
 */
export function PendingAttachmentList({
  attachments,
  onRemove,
  onRemoveAll,
  onCancel,
  className,
}: PendingAttachmentListProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [hovered, setHovered] = React.useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  const needsCollapse = attachments.length > COLLAPSED_CHIP_LIMIT;
  const visible = needsCollapse && !expanded ? attachments.slice(0, COLLAPSED_CHIP_LIMIT) : attachments;
  const hidden = needsCollapse && !expanded ? attachments.slice(COLLAPSED_CHIP_LIMIT) : [];
  const hiddenCount = attachments.length - COLLAPSED_CHIP_LIMIT;
  const hiddenHasWarning = hidden.some((a) => isOversized(a.sizeBytes));
  const hiddenStatus = hiddenStatusIcon(hidden);

  return (
    <div className={className} data-testid="pending-attachments">
      <div className="relative flex flex-wrap items-center gap-2">
        <HoverLabel attachment={hovered} />
        {visible.map((attachment) => (
          <div key={attachment.id} data-testid="pending-attachment-chip">
            <AttachmentChip
              attachment={attachment}
              onRemove={() => onRemove(attachment.id)}
              onHover={setHovered}
            />
          </div>
        ))}
        {needsCollapse && (
          <Badge
            variant="secondary"
            className={cn(
              'text-body flex cursor-pointer items-center gap-1 border bg-transparent px-2.5 py-1 hover:bg-muted/50',
              hiddenHasWarning ? 'border-destructive bg-destructive/10' : 'border-border/60'
            )}
            onClick={() => setExpanded((prev) => !prev)}
            data-testid="attachment-expand-toggle"
          >
            {expanded ? (
              <>
                Show less
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                {hiddenHasWarning && !hiddenStatus && <AlertCircle className="h-3 w-3 flex-shrink-0 text-destructive" />}
                {hiddenStatus}
                +{hiddenCount} more
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Badge>
        )}
        {onCancel && attachments.some((a) => a.uploadStatus) && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full p-0 text-muted-foreground hover:text-foreground"
                  onClick={onCancel}
                  data-testid="attachment-cancel-send"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-caption font-medium">Cancel send</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onRemoveAll && !attachments.some((a) => a.uploadStatus) && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full p-0 text-muted-foreground hover:text-foreground"
                  onClick={onRemoveAll}
                  data-testid="attachment-remove-all"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-caption font-medium">Remove all</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
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
 * Beyond COLLAPSED_CHIP_LIMIT non-HTML files, collapses with a "+N more" toggle.
 */
export function MessageAttachmentList({
  attachments,
  isAssistant,
  className,
}: MessageAttachmentListProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [hovered, setHovered] = React.useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  const htmlAttachments = isAssistant ? attachments.filter(isHtmlAttachment) : [];
  const otherAttachments = isAssistant
    ? attachments.filter((a) => !isHtmlAttachment(a))
    : attachments;

  const needsCollapse = otherAttachments.length > COLLAPSED_CHIP_LIMIT;
  const visibleOther = needsCollapse && !expanded ? otherAttachments.slice(0, COLLAPSED_CHIP_LIMIT) : otherAttachments;
  const hiddenOther = needsCollapse && !expanded ? otherAttachments.slice(COLLAPSED_CHIP_LIMIT) : [];
  const hiddenCount = otherAttachments.length - COLLAPSED_CHIP_LIMIT;
  const hiddenHasWarning = hiddenOther.some((a) => isOversized(a.sizeBytes));
  const hiddenStatus = hiddenStatusIcon(hiddenOther);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {htmlAttachments.map((attachment) => (
        <HtmlAttachmentEmbed key={attachment.id} attachment={attachment} />
      ))}
      {visibleOther.length > 0 && (
        <div className="relative flex flex-wrap items-center gap-2">
          <HoverLabel attachment={hovered} />
            {visibleOther.map((attachment) => (
              <div key={attachment.id} data-testid="message-attachment">
                <AttachmentChip attachment={attachment} onHover={setHovered} />
              </div>
            ))}
            {needsCollapse && (
              <Badge
                variant="secondary"
                className={cn(
                  'text-body flex cursor-pointer items-center gap-1 border bg-transparent px-2.5 py-1 hover:bg-muted/50',
                  hiddenHasWarning ? 'border-destructive bg-destructive/10' : 'border-border/60'
                )}
                onClick={() => setExpanded((prev) => !prev)}
                data-testid="attachment-expand-toggle"
              >
                {expanded ? (
                  <>
                    Show less
                    <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    {hiddenHasWarning && !hiddenStatus && <AlertCircle className="h-3 w-3 flex-shrink-0 text-destructive" />}
                    {hiddenStatus}
                    +{hiddenCount} more
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </Badge>
            )}
        </div>
      )}
    </div>
  );
}
