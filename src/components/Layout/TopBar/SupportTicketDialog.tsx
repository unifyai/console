'use client';

import React, { useState } from 'react';
import { CircleHelp, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/UI/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Textarea } from '@/components/UI/textarea';
import { toast } from 'sonner';
import { useSupportTicket } from '@/hooks/Support/useSupportTicket';
import { submitSupportTicket } from '@/lib/support/ticket';

const MAX_DESCRIPTION_LENGTH = 2000;

export default function SupportTicketDialog() {
  const {
    isOpen,
    isCapturing,
    isSubmitting,
    screenshotDataUrl,
    openDialog,
    closeDialog,
    submitTicket,
  } = useSupportTicket(submitSupportTicket);

  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (!trimmed) return;

    const result = await submitTicket(trimmed);
    if (result.success) {
      toast.success("Support ticket submitted — we'll take a look shortly.");
      setDescription('');
    } else {
      toast.error(result.error || 'Failed to submit ticket.');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeDialog();
      setDescription('');
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-6 w-6 rounded-full p-0"
              onClick={openDialog}
              disabled={isCapturing}
              data-testid="support-ticket-trigger"
            >
              {isCapturing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CircleHelp className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Report an issue</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl" data-testid="support-ticket-dialog">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Describe the problem you&apos;re experiencing. A screenshot of your current view is
              attached automatically.
            </DialogDescription>
          </DialogHeader>

          {screenshotDataUrl && (
            <div className="overflow-hidden rounded-md border border-[color:var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshotDataUrl}
                alt="Screenshot preview"
                className="max-h-80 w-full object-contain"
                data-testid="support-ticket-screenshot"
              />
            </div>
          )}

          <Textarea
            placeholder="What went wrong? Please describe the issue in detail…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
            className="min-h-[120px] resize-none"
            data-testid="support-ticket-description"
          />

          <p className="text-caption text-right text-muted-foreground">
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !description.trim()}
              data-testid="support-ticket-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
