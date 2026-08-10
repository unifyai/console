'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { Appearance, StripeElementsOptions } from '@stripe/stripe-js';
import { Button } from '../../UI/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../UI/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../UI/tooltip';
import { getStripe } from '@/lib/billing/stripe-client';
import { isBillingError } from '@/types/billing';
import type { BillingActions, BillingProfileApiResponse, PaymentMethodCard } from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

/** The subset of billing actions this manager needs. */
export type PaymentMethodActions = Pick<
  BillingActions,
  | 'createSetupIntent'
  | 'listPaymentMethods'
  | 'setDefaultPaymentMethod'
  | 'detachPaymentMethod'
  // Used to prefill the saved card's billing details so we don't re-ask.
  | 'getProfile'
>;

/**
 * Billing details (snake_case, as Stripe expects) sourced from the stored
 * billing profile and passed to `confirmSetup`. Because we opt out of *all*
 * collection in the PaymentElement (`fields.billingDetails: 'never'`), Stripe
 * requires every field to be supplied here — so all keys are present and we
 * use `null` for anything the profile doesn't have.
 */
interface StripeBillingDetails {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Stripe address field
    postal_code: string | null;
    country: string | null;
  };
}

const EMPTY_BILLING_DETAILS: StripeBillingDetails = {
  name: null,
  email: null,
  phone: null,
  address: {
    line1: null,
    line2: null,
    city: null,
    state: null,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Stripe address field
    postal_code: null,
    country: null,
  },
};

export interface PaymentMethodsSectionProps {
  actions: PaymentMethodActions;
  /**
   * Whether a subscription is active. Drives the guard against removing the
   * default card (renewals would have nothing to charge).
   */
  isSubscribed: boolean;
  /** Read-only org viewers can browse cards but not mutate them. */
  canEdit?: boolean;
  /**
   * Called after the saved-card set changes (added / removed / default
   * promoted) so the page can re-evaluate whether subscribe is unlocked.
   */
  onChanged?: () => void;
  /**
   * Optional controlled open state for the panel. When provided (with
   * ``onOpenChange``) the parent owns visibility — used so the subscribe
   * prerequisites checklist can pop this panel open. Omit for the default
   * self-managed behaviour.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// =============================================================================
// Card-entry form (rendered inside <Elements> so the hooks have context)
// =============================================================================

interface AddCardFormProps {
  /** Billing details from the stored profile, supplied at confirm time. */
  billingDetails: StripeBillingDetails;
  onAdded: () => void;
  onCancel: () => void;
}

/**
 * Stripe `PaymentElement` + confirm. The card number / expiry / CVC live in
 * Stripe-hosted iframes; we only own the surrounding layout and the submit.
 * `confirmSetup({ redirect: 'if_required' })` keeps the user in-app for
 * cards that don't need 3DS, and hands off only when the bank demands it.
 */
const AddCardForm = ({ billingDetails, onAdded, onCancel }: AddCardFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    // Elements was created with a SetupIntent client secret, so confirmSetup
    // collects + validates the card directly (no separate elements.submit()).
    // We opted out of collecting billing details in the element, so they're
    // supplied here from the stored profile.
    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- Stripe confirmSetup params
        payment_method_data: { billing_details: billingDetails },
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Could not save the card. Please try again.');
      setSubmitting(false);
      return;
    }

    // Saved + attached to the customer. Parent refetches the list.
    onAdded();
  };

  return (
    <div className="space-y-4" data-testid="add-card-form">
      {/*
        We already collect + store the customer's billing name and address
        (synced to the Stripe customer), so we opt out of every billing field
        here and supply them at confirm time, and turn off Link's email/phone
        enrollment — leaving just the card number / expiry / CVC.
      */}
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
          fields: { billingDetails: 'never' },
        }}
      />
      {error && (
        <p className="text-caption text-destructive" data-testid="add-card-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!stripe || !ready || submitting}
          data-testid="add-card-submit"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save card
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// Manager
// =============================================================================

function formatBrand(brand: string | null): string {
  if (!brand) return 'Card';
  return brand
    .split(/[\s_]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/** Project the stored billing profile onto Stripe's `billing_details` shape. */
function toStripeBillingDetails(p: BillingProfileApiResponse): StripeBillingDetails {
  const addr = p.billingAddress ?? {};
  const val = (v?: string) => (v && v.trim() ? v : null);
  return {
    name: val(p.name),
    email: val(p.billingEmail),
    phone: null,
    address: {
      line1: val(addr.line1),
      line2: val(addr.line2),
      city: val(addr.city),
      state: val(addr.state),
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Stripe address field
      postal_code: val(addr.postalCode),
      country: val(addr.country),
    },
  };
}

/** One-line summary of the saved cards for the section description. */
function summarize(cards: PaymentMethodCard[]): string {
  if (cards.length === 0) {
    return 'No cards on file — add one to back your subscription renewals and plan changes';
  }
  const def = cards.find((c) => c.isDefault) ?? cards[0];
  const label = `${formatBrand(def.brand)} •••• ${def.last4 ?? '????'} · default`;
  const others = cards.length - 1;
  return others > 0 ? `${label} (+${others} more)` : label;
}

/**
 * In-app payment-method management — replaces the Stripe Customer Portal
 * redirect for self-serve subscribers. Mirrors the billing-profile section:
 * a header + summary + "Manage" button that opens a right-side panel holding
 * the saved cards (set-default / remove) *and* the add-card form (Stripe
 * Elements). A card can be added before subscribing.
 */
export const PaymentMethodsSection = ({
  actions,
  isSubscribed,
  canEdit = true,
  onChanged,
  open: controlledOpen,
  onOpenChange,
}: PaymentMethodsSectionProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  // ``null`` until the first list call resolves. Refreshes then swap the array
  // in place, so a refetch never drops the summary back to its loading text.
  const [cards, setCards] = useState<PaymentMethodCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add-card subflow: "Add card" fetches a SetupIntent client secret (needed
  // before mounting <Elements>) and flips the panel into the card form.
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [startingAdd, setStartingAdd] = useState(false);
  // Billing details prefilled from the stored profile and supplied to
  // confirmSetup (we opt out of collecting them in the element).
  const [billingDetails, setBillingDetails] = useState<StripeBillingDetails>(EMPTY_BILLING_DETAILS);

  const stripePromise = useMemo(() => getStripe(), []);

  const refresh = useCallback(async () => {
    setError(null);
    const result = await actions.listPaymentMethods();
    if (isBillingError(result)) {
      // A brand-new account has no Stripe customer yet (404 from the list
      // endpoint) — that's an empty state, not an error to surface.
      setCards([]);
    } else {
      setCards(result.paymentMethods);
    }
  }, [actions]);

  // Load once for the summary line; the subscribe gate reads card presence
  // separately via the billing hook.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetAdd = () => {
    setClientSecret(null);
    setStartingAdd(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (onOpenChange) {
      onOpenChange(next);
    } else {
      setInternalOpen(next);
    }
    if (!next) {
      resetAdd();
      setError(null);
    }
  };

  // Refresh the card list whenever the panel opens — covers both the internal
  // "Manage" button and an external open (e.g. the subscribe checklist), which
  // sets the controlled prop without routing through ``handleOpenChange``.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleStartAdd = async () => {
    setStartingAdd(true);
    setError(null);
    // Fetch the SetupIntent + the stored profile together: the profile feeds
    // the card's billing_details so we don't re-ask name/address.
    const [intent, profile] = await Promise.all([
      actions.createSetupIntent(),
      actions.getProfile(),
    ]);
    if (isBillingError(intent)) {
      setError(intent.detail);
      setStartingAdd(false);
      return;
    }
    setBillingDetails(
      isBillingError(profile) ? EMPTY_BILLING_DETAILS : toStripeBillingDetails(profile)
    );
    setClientSecret(intent.clientSecret);
    setStartingAdd(false);
  };

  const handleCardAdded = async () => {
    resetAdd();
    const result = await actions.listPaymentMethods();
    let nextCards = isBillingError(result) ? [] : result.paymentMethods;
    // First card on the account → promote it to default automatically so
    // renewals have a deterministic card (and the badge shows) without an
    // extra click. Only when it's the *only* card, per the "no other card"
    // rule; additional cards never silently steal the default.
    if (nextCards.length === 1 && !nextCards[0].isDefault) {
      const promoted = await actions.setDefaultPaymentMethod(nextCards[0].id);
      if (!isBillingError(promoted)) nextCards = promoted.paymentMethods;
    }
    setCards(nextCards);
    onChanged?.();
  };

  const handleSetDefault = async (id: string) => {
    setBusyId(id);
    setError(null);
    const result = await actions.setDefaultPaymentMethod(id);
    if (isBillingError(result)) {
      setError(result.detail);
    } else {
      setCards(result.paymentMethods);
      onChanged?.();
    }
    setBusyId(null);
  };

  const handleRemove = async (id: string) => {
    setBusyId(id);
    setError(null);
    const result = await actions.detachPaymentMethod(id);
    if (isBillingError(result)) {
      setError(result.detail);
    } else {
      setCards(result.paymentMethods);
      onChanged?.();
    }
    setBusyId(null);
  };

  const appearance: Appearance = useMemo(() => {
    const isDark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    return { theme: isDark ? 'night' : 'stripe' };
  }, []);

  const elementsOptions: StripeElementsOptions | null = clientSecret
    ? { clientSecret, appearance }
    : null;

  return (
    <section className="space-y-4" data-testid="payment-methods-section">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-h3 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment methods
          </h2>
          <p className="text-body-muted mt-1" data-testid="payment-methods-summary">
            {cards === null ? 'Cards used for your subscription' : summarize(cards)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenChange(true)}
          className="gap-1.5"
          data-testid="manage-payment-methods"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Payment methods</SheetTitle>
            <SheetDescription>
              The card marked default backs your subscription renewals and plan changes. Card
              details are handled by Stripe and never touch our servers.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3" data-testid="payment-methods-list">
            {cards === null ? (
              <div className="flex items-center justify-center py-6">
                <Loader size={20} />
              </div>
            ) : cards.length === 0 ? (
              <p className="text-body-muted py-2" data-testid="no-cards">
                No cards on file yet.
              </p>
            ) : (
              cards.map((card) => {
                const lockedDefault = isSubscribed && card.isDefault;
                return (
                  <div
                    key={card.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                    data-testid="payment-method-row"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-body font-medium">
                          {formatBrand(card.brand)} •••• {card.last4 ?? '????'}
                          {card.isDefault && (
                            <span
                              className="text-label ml-2 rounded-full bg-primary-tint-10 px-2 py-0.5 text-primary"
                              data-testid="default-badge"
                            >
                              Default
                            </span>
                          )}
                        </p>
                        {card.expMonth && card.expYear && (
                          <p className="text-caption text-muted-foreground">
                            Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                          </p>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <TooltipProvider>
                        <div className="flex items-center gap-1">
                          {!card.isDefault && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetDefault(card.id)}
                                  disabled={busyId !== null}
                                  data-testid="set-default"
                                >
                                  {busyId === card.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Star className="mr-1 h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent size="sm" className="max-w-xs">
                                Charge this card for renewals and plan changes from now on.
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* A disabled button emits no pointer events, so
                                  wrap it in a focusable span to keep the
                                  tooltip reachable when removal is blocked. */}
                              <span tabIndex={0} className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemove(card.id)}
                                  disabled={busyId !== null || lockedDefault}
                                  data-testid="remove-card"
                                >
                                  {busyId === card.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent size="sm" className="max-w-xs">
                              {lockedDefault
                                ? 'Set another card as default before removing this one.'
                                : 'Remove this card.'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    )}
                  </div>
                );
              })
            )}

            {error && (
              <p className="text-caption text-destructive" data-testid="payment-methods-error">
                {error}
              </p>
            )}

            {/* Add-card subflow — inline within the panel. */}
            {canEdit &&
              (elementsOptions ? (
                <div className="rounded-md border border-border p-3">
                  <Elements stripe={stripePromise} options={elementsOptions}>
                    <AddCardForm
                      billingDetails={billingDetails}
                      onAdded={handleCardAdded}
                      onCancel={resetAdd}
                    />
                  </Elements>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleStartAdd}
                  disabled={startingAdd}
                  data-testid="add-card"
                >
                  {startingAdd ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-1 h-4 w-4" />
                  )}
                  Add card
                </Button>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};
