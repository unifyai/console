'use server';

import { stripe } from '@/lib/user/billing/stripe/stripe-instance';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import type Stripe from 'stripe';

/**
 * Describes the entity whose billing data should be used for a checkout session.
 *
 * - Personal workspace → `{ userId: '<id>' }`
 * - Organization workspace → `{ userId: '<id>', organizationId: 123 }`
 *
 * When `organizationId` is present, billing profile data (tax, etc.) is
 * resolved from the *organization's* billing account; the `userId` is still
 * stored in session metadata for audit purposes.
 */
export interface CheckoutContext {
  userId: string;
  organizationId?: number;
}

/**
 * Fetches billing-relevant data for a checkout session.
 *
 * In an organization context the billing profile (tax info, etc.) comes from
 * the *organization*, while user-level metadata (account age, etc.) is still
 * read from the user record so we keep rich fraud-prevention signals.
 *
 * @param ctx - Checkout context (user + optional org).
 */
async function getCheckoutData(ctx: CheckoutContext) {
  try {
    // Always fetch user data for audit/fraud metadata
    const userResponse = await OrchestraAdminClient.get('/user/by-user-id', {
      params: { user_id: ctx.userId },
    });
    console.log('[Checkout] admin user response:', userResponse.data);

    // Fetch eligibility from the correct entity (org or user)
    const eligibilityParams: Record<string, string> = {};
    if (ctx.organizationId) {
      eligibilityParams.organization_id = String(ctx.organizationId);
    } else {
      eligibilityParams.user_id = ctx.userId;
    }
    const eligibilityResponse = await OrchestraAdminClient.get('/billing_eligibility', {
      params: eligibilityParams,
    });
    console.log('[Checkout] auto-recharge eligibility response:', eligibilityResponse.data);

    // In org context, fetch the org's billing profile for tax info
    let taxId: string | undefined;
    let taxIdType: string | undefined;
    let billingEmail: string | undefined;
    let billingName: string | undefined;

    if (ctx.organizationId) {
      try {
        const orgBillingResponse = await OrchestraAdminClient.get('/billing/account-info', {
          params: { organization_id: String(ctx.organizationId) },
        });
        // The billing profile comes from the billing account; tax data
        // is synced there by the update_billing_profile endpoint.
        const ba = orgBillingResponse.data;
        taxId = ba?.taxId;
        taxIdType = ba?.taxIdType || 'eu_vat';
        billingEmail = ba?.billingEmail;
        billingName = ba?.name;
      } catch (e) {
        console.warn('[Checkout] Failed to fetch org billing profile, falling back to user', e);
      }
    }

    // Fall back to user-level values for personal context or if org fetch failed
    if (!ctx.organizationId || (!taxId && !billingName)) {
      taxId = taxId || (userResponse.data?.taxId as string | undefined);
      taxIdType = taxIdType || userResponse.data?.taxIdType || 'eu_vat';
      billingName = billingName || (userResponse.data?.name as string | undefined);
    }

    return {
      createdAt: userResponse.data?.createdAt,
      totalSpending: (eligibilityResponse.data?.totalSpending ?? 0) as number,
      email: billingEmail || (userResponse.data?.email as string | undefined),
      name: billingName,
      taxId,
      taxIdType,
      // Whether the entity has a tax ID determines tax-collection behaviour
      hasTaxId: !!taxId,
    };
  } catch (error) {
    console.error('Failed to fetch checkout data for Stripe metadata:', error);
    return {
      createdAt: null,
      totalSpending: 0,
      email: undefined as string | undefined,
      name: undefined as string | undefined,
      taxId: undefined as string | undefined,
      taxIdType: undefined as string | undefined,
      hasTaxId: false,
    };
  }
}

/**
 * Creates a new Stripe billing portal session for the user with the given customerID.
 * @param customerID - The Stripe customer ID of the user.
 * @returns The URL of the created billing portal session.
 */
export async function createCustomerPortalSession(customerID: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  try {
    const billingPortalSession = await stripeClient.billingPortal.sessions.create({
      customer: customerID,
    });
    return billingPortalSession.url;
  } catch (error) {
    // A live-mode customer can't open a portal with a test-mode key. Surface
    // a clear error so the API route can return a user-friendly message.
    if (isStripeModeConflict(error)) {
      console.warn(
        `[Stripe] Customer ${customerID} belongs to a different Stripe mode; ` +
        'cannot create portal session. The customer must complete a new ' +
        'checkout to get a valid customer ID for this environment.',
      );
      throw new Error(
        'Your billing profile was created in a different environment. ' +
        'Please purchase credits first to set up billing in this environment.',
      );
    }
    throw error;
  }
}

/**
 * Creates a Stripe Checkout session (redirect mode) and returns the session URL.
 *
 * Supports both personal and organization workspaces via `CheckoutContext`.
 * When no `customerID` is provided, the session is created with
 * `customer_creation: 'always'` so Stripe auto-creates the customer;
 * the webhook then persists the customer ID back to the BillingAccount.
 *
 * @param ctx - Checkout context (user + optional org).
 * @param customerID - Optional Stripe customer ID. Pass `null` / `undefined`
 *   for first-time buyers — Stripe will create one during checkout.
 * @returns The checkout session URL.
 */
export async function createCheckoutSession(
  ctx: CheckoutContext,
  customerID: string | null | undefined
): Promise<{ url: string; sessionId: string }> {
  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  const { createdAt, totalSpending, email, name, taxId, taxIdType, hasTaxId } =
    await getCheckoutData(ctx);

  let accountAgeDays = 0;
  if (createdAt) {
    const creationDate = new Date(createdAt);
    const today = new Date();
    accountAgeDays = Math.round((today.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  const isRepeatCustomer = totalSpending > 0;

  // Default credit quantity — user can adjust in checkout UI
  const defaultCreditQty = Number(process.env.STRIPE_DEFAULT_CREDIT_QTY) || 25;
  const minCreditQty = Number(process.env.STRIPE_MIN_CREDIT_QTY) || 5;
  const maxCreditQty = Number(process.env.STRIPE_MAX_CREDIT_QTY) || 500;

  // Resolve pre-configured Price ID based on workspace context
  const priceId = ctx.organizationId
    ? process.env.STRIPE_UNIFY_CREDITS_PRICE_ID_BUSINESS
    : process.env.STRIPE_UNIFY_CREDITS_PRICE_ID_PERSONAL;

  if (!priceId) {
    throw new Error(
      `Stripe price ID not configured for ${ctx.organizationId ? 'business' : 'personal'} workspace. ` +
        'Check STRIPE_UNIFY_CREDITS_PRICE_ID_PERSONAL / _BUSINESS env vars.'
    );
  }

  // Ensure existing Stripe customer has email + name for form pre-fill,
  // and sync tax ID if applicable.
  if (customerID) {
    await prefillCustomerFields(stripeClient, customerID, { email, name });
    if (hasTaxId && taxId) {
      await syncTaxIdToCustomer(stripeClient, customerID, taxId, taxIdType);
    }
  }

  // Build metadata — always include user_id for audit; include org_id when applicable.
  // credits_purchased is set to the default quantity here; the webhook updates it
  // to the actual amount after checkout (the user can adjust quantity in the UI).
  const metadata: Record<string, string> = {
    user_id: ctx.userId,
    credits_purchased: String(defaultCreditQty),
    user_total_spend: String(totalSpending),
    user_account_age_days: String(accountAgeDays),
    user_is_repeat_customer: String(isRepeatCustomer),
  };
  if (ctx.organizationId) {
    metadata.organization_id = String(ctx.organizationId);
  }

  // Build session params — include customer when known, otherwise let Stripe create one
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    submit_type: 'pay',
    line_items: [
      {
        price: priceId,
        quantity: defaultCreditQty,
        adjustable_quantity: {
          enabled: true,
          minimum: minCreditQty,
          maximum: maxCreditQty,
        },
      },
    ],
    payment_method_types: ['card'], // Explicitly card-only; excludes Link / "Save my info" checkbox
    automatic_tax: { enabled: true },
    client_reference_id: ctx.userId,
    success_url: `${process.env.NEXTAUTH_URL}/billing?sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing`,
    billing_address_collection: 'required',
    tax_id_collection: hasTaxId ? { enabled: true } : undefined,
    payment_method_options: { card: { request_three_d_secure: 'automatic' } },
    custom_text: {
      submit: { message: 'Credits will be added to your account immediately after payment.' },
    },
    payment_intent_data: { metadata },
    metadata,
  };

  if (customerID) {
    sessionParams.customer = customerID;
    sessionParams.customer_update = { address: 'auto', name: 'auto' };
  } else {
    // No customer yet — let Stripe create one during checkout.
    // The webhook will persist the customer ID to the BillingAccount.
    sessionParams.customer_creation = 'always';
    if (email) sessionParams.customer_email = email;
  }

  let checkoutSession: Stripe.Checkout.Session;
  try {
    checkoutSession = await stripeClient.checkout.sessions.create(sessionParams);
  } catch (error) {
    // If the stored customer ID belongs to a different Stripe mode (e.g. a
    // live-mode ID used with a test-mode key), drop it and retry so Stripe
    // creates a fresh customer. The webhook will persist the new ID and
    // overwrite the stale one in Orchestra.
    if (customerID && isStripeModeConflict(error)) {
      console.warn(
        `[Stripe] Customer ${customerID} is from a different Stripe mode. ` +
        'Retrying checkout without customer ID so a new one is created.',
      );
      const { customer: _c, customer_update: _u, ...rest } = sessionParams;
      const retryParams: Stripe.Checkout.SessionCreateParams = {
        ...rest,
        customer_creation: 'always',
        ...(email ? { customer_email: email } : {}),
      };
      checkoutSession = await stripeClient.checkout.sessions.create(retryParams);
    } else {
      throw error;
    }
  }

  if (!checkoutSession.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return { url: checkoutSession.url, sessionId: checkoutSession.id };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detects whether a Stripe API error is caused by a live-mode / test-mode
 * key mismatch — e.g. a live-mode customer ID being used with a test-mode
 * secret key (or vice versa).
 *
 * Stripe returns an `StripeInvalidRequestError` whose message contains both
 * "live mode" and "test mode" in this case.
 */
function isStripeModeConflict(error: unknown): boolean {
  if (error && typeof error === 'object' && 'type' in error) {
    const stripeErr = error as { type: string; message?: string };
    return (
      stripeErr.type === 'StripeInvalidRequestError' &&
      typeof stripeErr.message === 'string' &&
      stripeErr.message.includes('live mode') &&
      stripeErr.message.includes('test mode')
    );
  }
  return false;
}

/**
 * Best-effort update of an existing Stripe customer's email and name so that
 * Checkout pre-fills those fields.
 *
 * - **email**: Always synced to the canonical value from our DB so the
 *   checkout form never shows a stale or incorrect address.
 * - **name**: Only set when missing on the customer record (we don't overwrite
 *   a name the customer may have entered themselves in a previous checkout).
 */
async function prefillCustomerFields(
  stripeClient: NonNullable<typeof stripe>,
  customerId: string,
  fields: { email?: string; name?: string }
) {
  try {
    const customer = await stripeClient.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) return;

    const update: Record<string, string> = {};
    // Always sync email to canonical value (may have been set to userId by mistake)
    if (fields.email && customer.email !== fields.email) update.email = fields.email;
    // Only set name when missing
    if (fields.name && !customer.name) update.name = fields.name;

    if (Object.keys(update).length > 0) {
      await stripeClient.customers.update(customerId, update);
      console.log('[Stripe] Pre-filled customer fields', customerId, Object.keys(update));
    }
  } catch (e) {
    // Non-fatal — checkout will just show empty fields
    console.warn('[Stripe] Failed to pre-fill customer fields (non-fatal)', customerId, e);
  }
}

/**
 * Ensures a tax ID is present on a Stripe customer (idempotent).
 * Only adds the tax ID if no entry with the same `value` already exists.
 */
async function syncTaxIdToCustomer(
  stripeClient: NonNullable<typeof stripe>,
  customerId: string,
  taxId: string,
  taxIdType?: string
) {
  try {
    const existing = await stripeClient.customers.listTaxIds(customerId);
    const alreadyExists = existing.data.some((t: any) => t.value === taxId);
    if (!alreadyExists) {
      await stripeClient.customers.createTaxId(customerId, {
        type: (taxIdType || 'eu_vat') as any,
        value: taxId,
      });
    }
  } catch (e) {
    console.warn('[Stripe] Failed to sync tax ID for customer', customerId, e);
  }
}


