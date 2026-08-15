'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/UI/dialog';
import { Textarea } from '@/components/UI/textarea';
import { toast } from 'sonner';
import { useSupportTicket } from '@/hooks/Support/useSupportTicket';
import { submitSupportTicket } from '@/lib/support/ticket';
import { SCREENSHOT_IGNORE_CLASS } from '@/utils/support/capturePageScreenshot';
import { RailNavButton } from '@/components/Pages/Assistants/Rail/RailNavButton';

const MAX_DESCRIPTION_LENGTH = 2000;

function HelpSquareIcon({
  className,
  strokeWidth = 1.75,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="4" />
      <path d="M9.4 9a2.65 2.65 0 0 1 5.15.88c0 1.78-2.55 2.5-2.55 3.98" />
      <path d="M12 17.1h.01" />
    </svg>
  );
}

export default function SupportTicketDialog({ collapsed = false }: { collapsed?: boolean }) {
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
      console.error('Failed to submit support ticket', result.error);
      toast.error('Could not submit the ticket. Please try again.');
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
      <RailNavButton
        Icon={HelpSquareIcon}
        label="Report an issue"
        collapsed={collapsed}
        onClick={openDialog}
        testId="support-ticket-trigger"
      />

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-2xl overflow-hidden border-border bg-card p-0 shadow-pop-lg"
          overlayClassName={SCREENSHOT_IGNORE_CLASS}
          data-testid="support-ticket-dialog"
        >
          <div className="bg-muted/30 border-b border-border px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
                <HelpSquareIcon className="h-5 w-5" strokeWidth={2} />
              </div>
              <DialogHeader className="space-y-1.5 text-left">
                <p className="text-label-muted uppercase tracking-[0.16em]">Support</p>
                <DialogTitle className="text-foreground">Report an Issue</DialogTitle>
                <DialogDescription className="text-body-muted text-foreground/80">
                  Describe the problem you&apos;re experiencing. When available, a screenshot of
                  your current view is attached automatically.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          <div className="space-y-4 bg-card p-6">
            {isCapturing ? (
              <p
                className="text-caption bg-muted/20 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-muted-foreground"
                data-testid="support-ticket-capturing"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Capturing a screenshot of your view — you can start writing now.
              </p>
            ) : screenshotDataUrl ? (
              <div className="overflow-hidden rounded-lg border border-border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotDataUrl}
                  alt="Screenshot preview"
                  className="max-h-80 w-full object-contain object-left-top"
                  data-testid="support-ticket-screenshot"
                />
              </div>
            ) : (
              <p className="text-caption bg-muted/20 rounded-lg border border-dashed border-border px-3 py-2 text-muted-foreground">
                Screenshot unavailable for this view — you can still submit your report.
              </p>
            )}

            <Textarea
              placeholder="What went wrong? Please describe the issue in detail…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="min-h-[120px] resize-none bg-background"
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
