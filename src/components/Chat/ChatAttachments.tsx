import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/UI/badge';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  getAttachmentIcon,
  getAttachmentColor,
  truncateFilename,
  formatFileSize,
} from './attachmentUtils';
import type { ChatAttachment } from '@/types/assistants/chat';

// =============================================================================
// ATTACHMENT CHIP
// =============================================================================

export interface AttachmentChipProps {
  attachment: ChatAttachment;
  onRemove?: () => void;
  className?: string;
}

/**
 * Single attachment chip with icon, filename, and optional remove button.
 */
export function AttachmentChip({ attachment, onRemove, className }: AttachmentChipProps) {
  const Icon = getAttachmentIcon(attachment.type);
  const iconColor = getAttachmentColor(attachment.type);
  const truncatedName = truncateFilename(attachment.name);
  const showRemoveButton = !!onRemove;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn('text-body flex items-center gap-1.5 bg-muted px-2 py-1', className)}
            data-testid="attachment-chip"
          >
            <Icon
              className="h-3.5 w-3.5 flex-shrink-0"
              style={{ color: iconColor }}
              data-testid="attachment-icon"
            />
            <span className="truncate" data-testid="attachment-name">
              {truncatedName}
            </span>
            {showRemoveButton && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-0.5 h-4 w-4 rounded-full p-0 hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                aria-label={`Remove ${attachment.name}`}
                data-testid="attachment-remove"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-caption space-y-0.5">
            <p className="font-medium">{attachment.name}</p>
            <p className="text-muted-foreground">{formatFileSize(attachment.size)}</p>
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
  attachments: ChatAttachment[];
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
  attachments: ChatAttachment[];
  className?: string;
}

/**
 * List of attachments displayed in a sent message bubble.
 * No remove buttons - display only.
 */
export function MessageAttachmentList({ attachments, className }: MessageAttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {attachments.map((attachment) => (
        <div key={attachment.id} data-testid="message-attachment">
          <AttachmentChip attachment={attachment} />
        </div>
      ))}
    </div>
  );
}
