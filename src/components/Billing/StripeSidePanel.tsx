'use client';

/**
 * StripeSidePanel
 *
 * A slide-over panel that embeds a Stripe Checkout form inline using Stripe's
 * `<EmbeddedCheckout>` component.  The user never leaves the page, preserving
 * their in-progress work (e.g., assistant customization).
 *
 * Flow:
 *   1. Panel opens → "prompt" step with a description and "Continue" button
 *   2. User clicks Continue → embedded checkout loads in-panel
 *   3. Checkout completes → polls for payment method → "success" step
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/UI/sheet';
import { Button } from '@/components/UI/button';
import { Alert, AlertDescription } from '@/components/UI/alert';
import { CreditCard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import getStripe from '@/lib/user/billing/stripe/get-stripe';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';

// Reuse the singleton Stripe.js promise — will be null if publishable key is missing
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? getStripe() : null;

// =============================================================================
// Types
// =============================================================================

export type StripePanelStep = 'prompt' | 'checkout' | 'waiting' | 'success' | 'error';

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
 * Fetches the embedded checkout client secret from the backend.
 */
export async function fetchEmbeddedCheckoutClientSecret(): Promise<string | null> {
  try {
    const response = await fetch('/api/stripe/embeddedCheckoutSession');
    if (!response.ok) return null;
    const data = await response.json();
    return data.clientSecret ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches a Stripe checkout session URL from the backend (fallback for redirect mode).
 */
export async function fetchCheckoutUrl(): Promise<string | null> {
  try {
    const response = await fetch('/api/stripe/checkoutSession');
    if (!response.ok) return null;
    const data = await response.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Checks if the user now has a payment method.
 */
export async function checkPaymentMethod(): Promise<boolean> {
  try {
    const response = await fetch('/api/stripe/defaultPaymentMethod');
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.defaultPaymentMethod;
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

/**
 * Determines the next step based on current state.
 */
export function resolveStep(
  hasPaymentMethod: boolean,
  isCheckingOut: boolean,
  error: string | null
): StripePanelStep {
  if (error) return 'error';
  if (hasPaymentMethod) return 'success';
  if (isCheckingOut) return 'waiting';
  return 'prompt';
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
  const [step, setStep] = React.useState<StripePanelStep>('prompt');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const pollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when panel opens
  React.useEffect(() => {
    if (open) {
      setStep('prompt');
      setError(null);
      setIsLoading(false);
      setClientSecret(null);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [open]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Start polling for payment method once we move to checkout
  const startPolling = React.useCallback(() => {
    if (pollingRef.current) return; // already polling
    pollingRef.current = setInterval(async () => {
      const hasPayment = await checkPaymentMethod();
      if (hasPayment) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        if (pendingCreditToken) {
          await claimCreditGrantToken(pendingCreditToken);
        }
        setStep('success');
        onSuccess?.();
      }
    }, 3000);
  }, [onSuccess, pendingCreditToken]);

  const handleStartCheckout = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Try embedded checkout first
    if (stripePromise) {
      const secret = await fetchEmbeddedCheckoutClientSecret();
      if (secret) {
        setClientSecret(secret);
        setStep('checkout');
        setIsLoading(false);
        startPolling();
        return;
      }
    }

    // Fallback: redirect mode (opens new tab)
    const url = await fetchCheckoutUrl();
    if (!url) {
      setError('Failed to create checkout session. Please try again.');
      setStep('error');
      setIsLoading(false);
      return;
    }

    window.open(url, '_blank');
    setStep('waiting');
    setIsLoading(false);
    startPolling();
  }, [startPolling]);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Stripe Embedded Checkout callback when the session completes
  const handleCheckoutComplete = React.useCallback(async () => {
    // The polling will catch the payment method, but we can also directly check
    const hasPayment = await checkPaymentMethod();
    if (hasPayment) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (pendingCreditToken) {
        await claimCreditGrantToken(pendingCreditToken);
      }
      setStep('success');
      onSuccess?.();
    }
  }, [onSuccess, pendingCreditToken]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={step === 'checkout' ? 'w-[520px] sm:w-[600px]' : 'w-[400px] sm:w-[480px]'}
        data-testid="stripe-side-panel"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {step === 'success' ? 'Payment Method Added' : 'Add Payment Method'}
          </SheetTitle>
          <SheetDescription>
            {step === 'success'
              ? 'Your payment method has been set up successfully.'
              : step === 'checkout'
                ? 'Complete the payment below to add your payment method and purchase credits.'
                : 'Add a payment method to start using billable features.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Step: Prompt */}
          {step === 'prompt' && (
            <>
              <p className="text-body text-sm leading-relaxed">
                To use billable features like hiring assistants, chatting, generating photos, and
                designing voices, you need a payment method on file.
              </p>
              <p className="text-body-muted text-sm">
                Complete the secure Stripe checkout below to add your card and purchase credits.
              </p>
              <Button
                onClick={handleStartCheckout}
                disabled={isLoading}
                className="w-full gap-2"
                data-testid="stripe-panel-add-button"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading checkout...
                  </>
                ) : (
                  'Add Payment Method'
                )}
              </Button>
            </>
          )}

          {/* Step: Embedded Checkout */}
          {step === 'checkout' && clientSecret && stripePromise && (
            <div className="min-h-[400px]" data-testid="stripe-embedded-checkout">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret,
                  onComplete: handleCheckoutComplete,
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}

          {/* Step: Waiting for checkout completion (fallback redirect mode) */}
          {step === 'waiting' && (
            <>
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-body text-center text-sm">
                  Complete the checkout in the Stripe tab.
                  <br />
                  This panel will update automatically once done.
                </p>
              </div>
              <Button variant="outline" onClick={handleClose} className="w-full">
                Close
              </Button>
            </>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <>
              <Alert variant="default" data-testid="stripe-panel-success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {pendingCreditToken
                    ? 'Payment method added and credits have been applied to your account!'
                    : 'Payment method added successfully. You can now use all billable features.'}
                </AlertDescription>
              </Alert>
              <Button onClick={handleClose} className="w-full" data-testid="stripe-panel-done">
                Done
              </Button>
            </>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <>
              <Alert variant="destructive" data-testid="stripe-panel-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button onClick={handleStartCheckout} className="w-full gap-2">
                Try Again
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
