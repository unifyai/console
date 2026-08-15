'use client';

/**
 * useSupportTicket – Hook for the support ticket dialog.
 *
 * Manages screenshot capture, form submission state, and rate-limit
 * feedback.  Accepts the submit function as a parameter so the hook
 * remains testable (callers can pass a mock).
 *
 * Rasterizing the page costs seconds on a dense view, so the dialog opens
 * immediately and the capture runs alongside it — the preview fills in when
 * it lands, and a submit issued mid-capture awaits the in-flight promise so
 * the screenshot is still attached.
 *
 * Pattern mirrors:
 *   @/hooks/Billing/useBilling.ts
 *   @/hooks/Assistants/useAssistantActions.ts
 */

import { useState, useRef, useCallback } from 'react';
import { capturePageScreenshot } from '@/utils/support/capturePageScreenshot';
import type { SupportTicketPayload, SupportTicketResult } from '@/types/support';

// =============================================================================
// Types
// =============================================================================

type SubmitFn = (payload: SupportTicketPayload) => Promise<SupportTicketResult>;

export interface UseSupportTicketReturn {
  isOpen: boolean;
  isCapturing: boolean;
  isSubmitting: boolean;
  screenshotDataUrl: string | null;
  openDialog: () => void;
  closeDialog: () => void;
  submitTicket: (description: string) => Promise<SupportTicketResult>;
}

// =============================================================================
// Hook
// =============================================================================

export function useSupportTicket(submitFn: SubmitFn): UseSupportTicketReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  // The capture outlives the click, so submit reads the promise rather than
  // the state; it also identifies the run, letting a result that lands after
  // a close (or a re-open) be discarded.
  const captureRef = useRef<Promise<string | null> | null>(null);

  // ── Open (show dialog now, capture alongside it) ──────────────────
  const openDialog = useCallback(() => {
    setIsOpen(true);
    setScreenshotDataUrl(null);
    setIsCapturing(true);

    const capture = capturePageScreenshot();
    captureRef.current = capture;

    void capture.then((dataUrl) => {
      if (captureRef.current !== capture) return;
      setScreenshotDataUrl(dataUrl);
      setIsCapturing(false);
    });
  }, []);

  // ── Close ─────────────────────────────────────────────────────────
  const closeDialog = useCallback(() => {
    captureRef.current = null;
    setIsOpen(false);
    setIsCapturing(false);
    setScreenshotDataUrl(null);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────
  const submitTicket = useCallback(
    async (description: string): Promise<SupportTicketResult> => {
      setIsSubmitting(true);
      try {
        const result = await submitFn({
          description,
          screenshotDataUrl: (await captureRef.current) ?? null,
          pageUrl: window.location.pathname,
          userAgent: navigator.userAgent,
        });
        if (result.success) {
          closeDialog();
        }
        return result;
      } finally {
        setIsSubmitting(false);
      }
    },
    [submitFn, closeDialog]
  );

  return {
    isOpen,
    isCapturing,
    isSubmitting,
    screenshotDataUrl,
    openDialog,
    closeDialog,
    submitTicket,
  };
}
