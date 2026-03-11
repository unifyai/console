'use client';

/**
 * StripeSidePanel
 *
 * A slide-over panel that opens Stripe Checkout in a new tab and polls the
 * specific checkout session for completion.  When the session completes
 * (payment_status === 'paid'), the panel auto-closes and a success toast is
 * shown.
 *
 * Flow:
 *   1. Panel opens → Stripe Checkout opens in a new browser tab
 *   2. Panel shows a "waiting" state with a spinner
 *   3. Polls the session status every 3 s until paid → success toast, auto-close
 *   4. If a pending credit grant token exists it is auto-claimed
 *
 * Usage:
 *   <StripeSidePanel
 *     open={isPanelOpen}
 *     onOpenChange={setIsPanelOpen}
 *     onSuccess={() => refetchBillingStatus()}
 *   />
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
} from '@/components/UI/sheet';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  showErrorToast,
  showSuccessToast,
} from '@/components/Common/Toasts/notifications';

// =============================================================================
// Types
// =============================================================================

export type StripePanelStep = 'loading' | 'waiting' | 'error';

export interface StripeSidePanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when billing setup completes successfully */
  onSuccess?: () => void;
  /** Optional pending credit grant token to claim after successful setup */
  pendingCreditToken?: string | null;
}

// =============================================================================
// Helper functions (exported for testing)
// =============================================================================

/**
 * Fetches a Stripe checkout session URL and its session ID from the backend.
 */
export async function fetchCheckoutSession(): Promise<{ url: string; sessionId: string } | null> {
  try {
    const response = await fetch('/api/stripe/checkoutSession');
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.url || !data.sessionId) return null;
    return { url: data.url, sessionId: data.sessionId };
  } catch {
    return null;
  }
}

/**
 * Checks the status of a specific checkout session.
 * Returns true when the session's payment is confirmed ('paid').
 */
export async function checkSessionStatus(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/stripe/session-status?sessionId=${sessionId}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.paymentStatus === 'paid';
  } catch {
    return false;
  }
}

/**
 * Claims a credit grant token.
 * Returns true on success, false on failure.
 */
export async function claimCreditGrantToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// Component
// =============================================================================

export function StripeSidePanel({
  open,
  onOpenChange,
  onSuccess,
  pendingCreditToken,
}: StripeSidePanelProps) {
  const [step, setStep] = React.useState<StripePanelStep>('loading');
  const [checkoutUrl, setCheckoutUrl] = React.useState<string | null>(null);
  const pollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = React.useRef<string | null>(null);

  // ── Refs for latest callback values ─────────────────────────────────
  // These refs break the stale-closure problem: the setInterval callback
  // always reads the *latest* onSuccess / onOpenChange through the ref,
  // even though the interval itself is never recreated.
  const onSuccessRef = React.useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const pendingCreditTokenRef = React.useRef(pendingCreditToken);
  pendingCreditTokenRef.current = pendingCreditToken;

  // ── Cleanup polling ─────────────────────────────────────────────────
  const stopPolling = React.useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // ── Success handler ─────────────────────────────────────────────────
  const handleSuccess = React.useCallback(async () => {
    stopPolling();

    const token = pendingCreditTokenRef.current;
    if (token) {
      await claimCreditGrantToken(token);
    }

    showSuccessToast(
      'Payment complete',
      token
        ? 'Credits have been applied to your account.'
        : 'You can now use all billable features.'
    );

    onSuccessRef.current?.();
    onOpenChangeRef.current(false);
  }, [stopPolling]);

  // ── Start polling the specific session ──────────────────────────────
  const startSessionPolling = React.useCallback((sessionId: string) => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const isPaid = await checkSessionStatus(sessionId);
      if (isPaid) {
        await handleSuccess();
      }
    }, 3000);
  }, [handleSuccess]);

  // ── Open checkout in new tab ────────────────────────────────────────
  const openCheckout = React.useCallback(async () => {
    setStep('loading');
    setCheckoutUrl(null);
    sessionIdRef.current = null;

    const result = await fetchCheckoutSession();
    if (!result) {
      showErrorToast(
        new Error('Failed to create checkout session'),
        'Failed to create checkout session. Please try again.'
      );
      setStep('error');
      return;
    }

    sessionIdRef.current = result.sessionId;
    setCheckoutUrl(result.url);
    window.open(result.url, '_blank');
    setStep('waiting');
    startSessionPolling(result.sessionId);
  }, [startSessionPolling]);

  // ── When the panel opens, launch checkout ───────────────────────────
  React.useEffect(() => {
    if (open) {
      openCheckout();
    } else {
      stopPolling();
      sessionIdRef.current = null;
      setCheckoutUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // ── Re-open checkout (if user closed the tab by accident) ──────────
  const handleReopenCheckout = React.useCallback(() => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    }
  }, [checkoutUrl]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={[
          'flex h-full w-[520px] flex-col overflow-hidden p-0 sm:w-[600px]',
          '[&>button]:z-20 [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:p-1.5',
          '[&>button]:opacity-100 [&>button]:shadow-md [&>button]:backdrop-blur',
          '[&>button]:hover:bg-white [&>button]:right-3 [&>button]:top-3',
          '[&>button>svg]:h-4 [&>button>svg]:w-4 [&>button>svg]:text-gray-700',
        ].join(' ')}
        data-testid="stripe-side-panel"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Loading — fetching checkout URL */}
        {step === 'loading' && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Waiting for checkout to complete in the other tab */}
        {step === 'waiting' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-2 text-center">
              <p className="text-body">
                Complete the checkout in the Stripe tab
              </p>
              <p className="text-caption">
                This panel will close automatically once the payment is confirmed.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-2"
              onClick={handleReopenCheckout}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Reopen checkout tab
            </Button>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
            <p className="text-body-sm text-destructive">
              Something went wrong. Please try again.
            </p>
            <Button variant="outline" size="sm" onClick={openCheckout}>
              Retry
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
