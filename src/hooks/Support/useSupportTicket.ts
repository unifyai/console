'use client';

/**
 * useSupportTicket – Hook for the support ticket dialog.
 *
 * Manages screenshot capture, form submission state, and rate-limit
 * feedback.  Accepts the submit function as a parameter so the hook
 * remains testable (callers can pass a mock).
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
  openDialog: () => Promise<void>;
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

  // Guard against double-clicks while capture is in progress
  const capturingRef = useRef(false);

  // ── Open (capture screenshot first, then show dialog) ─────────────
  const openDialog = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setIsCapturing(true);

    try {
      setScreenshotDataUrl(await capturePageScreenshot());
    } catch {
      setScreenshotDataUrl(null);
    } finally {
      setIsCapturing(false);
      capturingRef.current = false;
      setIsOpen(true);
    }
  }, []);

  // ── Close ─────────────────────────────────────────────────────────
  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setScreenshotDataUrl(null);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────
  const submitTicket = useCallback(
    async (description: string): Promise<SupportTicketResult> => {
      setIsSubmitting(true);
      try {
        const result = await submitFn({
          description,
          screenshotDataUrl,
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
    [submitFn, screenshotDataUrl, closeDialog]
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
