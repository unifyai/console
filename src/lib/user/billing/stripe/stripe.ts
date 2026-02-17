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
    console.log('[Checkout] admin auth-user response:', userResponse.data);

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
        taxId = ba?.tax_id;
        taxIdType = ba?.tax_id_type || 'eu_vat';
        billingEmail = ba?.billing_email;
        billingName = ba?.name;
      } catch (e) {
        console.warn('[Checkout] Failed to fetch org billing profile, falling back to user', e);
      }
    }

    // Fall back to user-level values for personal context or if org fetch failed
    if (!ctx.organizationId || (!taxId && !billingName)) {
      taxId = taxId || (userResponse.data?.tax_id as string | undefined);
      taxIdType = taxIdType || (userResponse.data?.tax_id_type || 'eu_vat');
      billingName = billingName || (userResponse.data?.name as string | undefined);
    }

    return {
      createdAt: userResponse.data?.created_at,
      totalSpending: (eligibilityResponse.data?.total_spending ?? 0) as number,
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
 * Updates the Stripe customer ID for the user with the given userID (in Orchestra).
 *
 * @deprecated Only used by ensureStripeCustomer which is itself deprecated.
 * The webhook now handles persisting the customer ID from checkout sessions.
 * See design doc §5.7 for cleanup plan.
 */
export async function updateStripeCustomerID(userID: string, stripeCustomerID: string) {
  const response = await OrchestraAdminClient.put('/stripe_customer_id', null, {
    params: { id: userID, stripe_customer_id: stripeCustomerID },
  });
  return response;
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
  const billingPortalSession = await stripeClient.billingPortal.sessions.create({
    customer: customerID,
    return_url: process.env.NEXTAUTH_URL + '/billing',
  });

  return billingPortalSession.url;
}

/**
 * Retrieves the default payment method ID for a given Stripe customer ID.
 * @param customerID - The Stripe customer ID.
 * @returns The default payment method ID, or null if the customer is deleted or no default payment method is found.
 */
export async function getCustomerDefaultPaymentMethod(customerID: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;
  const customer = await stripeClient.customers.retrieve(customerID);

  if ('deleted' in customer && customer.deleted) {
    return null;
  }

  if (!customer.invoice_settings?.default_payment_method) {
    return null;
  }

  const paymentMethodId = customer.invoice_settings.default_payment_method as string;

  return paymentMethodId;
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
): Promise<string> {
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

  // Resolve price
  const rawPriceOrProductId = ctx.organizationId ? process.env.STRIPE_PRICE_ID_BUSINESS : process.env.STRIPE_PRICE_ID_PERSONAL;
  if (!rawPriceOrProductId) {
    throw new Error(`Missing STRIPE_PRICE_ID_${ctx.organizationId ? 'BUSINESS' : 'PERSONAL'} environment variable.`);
  }

  let priceId: string;
  if (rawPriceOrProductId.startsWith('prod_')) {
    const pricesForProduct = await stripeClient.prices.list({ product: rawPriceOrProductId });
    const activePrice = pricesForProduct.data.find((p) => p.active);
    if (!activePrice) {
      throw new Error(`No active prices found for product ID ${rawPriceOrProductId}.`);
    }
    priceId = activePrice.id;
  } else {
    priceId = rawPriceOrProductId;
  }

  const price = await stripeClient.prices.retrieve(priceId);
  const creditsPurchased = (price.unit_amount || 0) / 100;

  // Sync tax ID on an existing customer before creating the session
  if (customerID && hasTaxId && taxId) {
    await syncTaxIdToCustomer(stripeClient, customerID, taxId, taxIdType);
  }

  // Build metadata — always include user_id for audit; include org_id when applicable
  const metadata: Record<string, string> = {
    user_id: ctx.userId,
    credits_purchased: String(creditsPurchased),
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
    line_items: [{ price: priceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    client_reference_id: ctx.userId,
    success_url: `${process.env.NEXTAUTH_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing`,
    billing_address_collection: 'required',
    tax_id_collection: hasTaxId ? { enabled: true } : undefined,
    payment_method_options: { card: { request_three_d_secure: 'any' } },
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

  const checkoutSession = await stripeClient.checkout.sessions.create(sessionParams);

  if (!checkoutSession.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return checkoutSession.url;
}

/**
 * Creates a Stripe Checkout session in embedded mode for use with
 * the `<EmbeddedCheckout>` component.  Returns the `client_secret` rather
 * than a redirect URL, allowing the checkout to be embedded in an iframe
 * inside the StripeSidePanel.
 *
 * Supports both personal and organization workspaces via `CheckoutContext`.
 * When no `customerID` is provided, the session is created with
 * `customer_creation: 'always'` so Stripe auto-creates the customer;
 * the webhook then persists the customer ID back to the BillingAccount.
 *
 * @param ctx - Checkout context (user + optional org).
 * @param customerID - Optional Stripe customer ID. Pass `null` / `undefined`
 *   for first-time buyers — Stripe will create one during checkout.
 * @returns The checkout session client_secret.
 */
export async function createEmbeddedCheckoutSession(
  ctx: CheckoutContext,
  customerID: string | null | undefined
): Promise<string> {
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

  // Resolve price
  const rawPriceOrProductId = ctx.organizationId ? process.env.STRIPE_PRICE_ID_BUSINESS : process.env.STRIPE_PRICE_ID_PERSONAL;
  if (!rawPriceOrProductId) {
    throw new Error(`Missing STRIPE_PRICE_ID_${ctx.organizationId ? 'BUSINESS' : 'PERSONAL'} environment variable.`);
  }

  let priceId: string;
  if (rawPriceOrProductId.startsWith('prod_')) {
    const pricesForProduct = await stripeClient.prices.list({ product: rawPriceOrProductId });
    const activePrice = pricesForProduct.data.find((p) => p.active);
    if (!activePrice) {
      throw new Error(`No active prices found for product ${rawPriceOrProductId}.`);
    }
    priceId = activePrice.id;
  } else {
    priceId = rawPriceOrProductId;
  }

  const price = await stripeClient.prices.retrieve(priceId);
  const creditsPurchased = (price.unit_amount || 0) / 100;

  // Sync tax ID on an existing customer before creating the session
  if (customerID && hasTaxId && taxId) {
    await syncTaxIdToCustomer(stripeClient, customerID, taxId, taxIdType);
  }

  // Build metadata
  const metadata: Record<string, string> = {
    user_id: ctx.userId,
    credits_purchased: String(creditsPurchased),
    user_total_spend: String(totalSpending),
    user_account_age_days: String(accountAgeDays),
    user_is_repeat_customer: String(isRepeatCustomer),
  };
  if (ctx.organizationId) {
    metadata.organization_id = String(ctx.organizationId);
  }

  // Build session params
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    ui_mode: 'embedded',
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    client_reference_id: ctx.userId,
    return_url: `${process.env.NEXTAUTH_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
    billing_address_collection: 'required',
    tax_id_collection: hasTaxId ? { enabled: true } : undefined,
    payment_method_options: { card: { request_three_d_secure: 'any' } },
    payment_intent_data: { metadata },
    metadata,
  };

  if (customerID) {
    sessionParams.customer = customerID;
    sessionParams.customer_update = { address: 'auto', name: 'auto' };
  } else {
    // No customer yet — let Stripe create one during checkout.
    sessionParams.customer_creation = 'always';
    if (email) sessionParams.customer_email = email;
  }

  const session = await stripeClient.checkout.sessions.create(sessionParams);

  if (!session.client_secret) {
    throw new Error('Failed to create embedded checkout session: no client_secret returned');
  }

  return session.client_secret;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Card fingerprints (currently unused — see design doc §5.6)
// ---------------------------------------------------------------------------

/**
 * Retrieves the list of card fingerprints associated with a given Stripe customer ID.
 * @param customerID - The Stripe customer ID of the user.
 * @returns An array of card fingerprints associated with the user's customer ID.
 * @deprecated Currently unused. See design doc §5.6 for re-introduction plan.
 */
export async function getStripeFingerprints(customerID: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  try {
    const paymentMethods = await stripeClient.customers.listPaymentMethods(customerID);

    // Filter for card payment methods only
    const fingerprints = paymentMethods.data
      .filter((entry: any) => entry.type === 'card' && entry.card) // Ensure it's a card and has the card object
      .map((entry: any) => entry.card.fingerprint); // Map to fingerprints

    return fingerprints;
  } catch (error) {
    console.error('Error retrieving payment methods:', error);
    throw error;
  }
}

export interface StripeCustomerInfo {
  id: string;
}

/**
 * Ensures a Stripe customer exists for the given user. If a customer ID is already stored in Orchestra, it will be reused.
 * Otherwise, a new customer is created and the ID is stored back in Orchestra.
 * The function also updates the customer's name, address and tax ID if new information is provided.
 *
 * @deprecated No longer used — checkout sessions now use `customer_creation: 'always'`
 * when no customer exists, and the webhook persists the customer ID.
 * See design doc §5.7 for cleanup plan.
 */
export async function ensureStripeCustomer(params: {
  userId: string;
  email: string;
  name?: string;
  address?: Stripe.AddressParam;
  taxId?: string;
  taxIdType?: string;
  clearTaxInfo?: boolean;
  taxExempt?: boolean;
}): Promise<string> {
  const { userId, email, name, address, taxId, taxIdType, clearTaxInfo, taxExempt } = params;

  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  // 1. Check Orchestra for existing stripe_customer_id
  const billingDetails = await (
    await import('@/lib/user/billing/billing')
  ).getUserBillingDetails(userId);
  let customerId = billingDetails[0]?.stripeCustomerId;

  // 2. Create if missing
  if (!customerId) {
    const newCustomer = await stripeClient.customers.create({ email, name, address });
    customerId = newCustomer.id;
    await updateStripeCustomerID(userId, customerId);
    console.log('[Stripe] Created new customer', customerId, 'for user', userId);
  }

  // 3. Update customer with latest info where applicable
  const updatePayload: Stripe.CustomerUpdateParams = {} as Stripe.CustomerUpdateParams;
  if (name) updatePayload.name = name;

  if (clearTaxInfo) {
    console.log('[Stripe] Clearing tax info for customer', customerId);
    updatePayload.address = null as any; // clears stored address
    updatePayload.tax_exempt = 'none';
  } else if (address) {
    updatePayload.address = address as any;
  }

  if (!clearTaxInfo && typeof taxExempt === 'boolean') {
    updatePayload.tax_exempt = taxExempt ? 'exempt' : 'none';
  }

  if (Object.keys(updatePayload).length) {
    try {
      console.log('[Stripe] Updating customer', customerId, 'with', updatePayload);
      await stripeClient.customers.update(customerId, updatePayload);
    } catch (e) {
      console.warn('Failed to update Stripe customer', customerId, e);
    }
  }

  // 4. Handle tax ID
  if (clearTaxInfo) {
    try {
      const existing = await stripeClient.customers.listTaxIds(customerId);
      console.log(
        '[Stripe] Existing tax IDs to clear:',
        existing.data.map((t) => ({ id: t.id, value: t.value, type: t.type }))
      );
      for (const tid of existing.data) {
        await stripeClient.customers.deleteTaxId(customerId, tid.id);
      }
    } catch (e) {
      console.warn('Failed to clear tax IDs for customer', e);
    }
  } else if (taxId) {
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
      console.warn('Failed to ensure tax ID for customer', e);
    }
  }

  return customerId;
}
