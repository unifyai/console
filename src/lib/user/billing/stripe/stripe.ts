"use server";

import { stripe } from "@/lib/user/billing/stripe/stripe-instance";
import { OrchestraAdminClient } from "@/lib/orchestra/orchestra-client";
import type Stripe from 'stripe';


/**
 * Fetches user data required for enriched metadata.
 * @param userID - The ID of the user.
 * @returns An object containing user creation date and total spending.
 */
async function getUserData(userID: string) {
  try {
    const userResponse = await OrchestraAdminClient.get('/auth-user/by-user-id', {
      params: { user_id: userID },
    });
    console.log('[Checkout] admin auth-user response:', userResponse.data);
    const spendingResponse = await OrchestraAdminClient.get('/user_billing_eligibility', {
      params: { user_id: userID },
    });
    console.log('[Checkout] billing eligibility response:', spendingResponse.data);

    return {
      createdAt: userResponse.data?.created_at, // e.g., '2023-01-01T12:00:00Z'
      totalSpending: (spendingResponse.data?.total_spending ?? 0) as number,
      accountType: (
        userResponse.data?.business_classification?.account_type ??
        userResponse.data?.account_type ??
        "individual"
      ) as "individual" | "business",
      email: userResponse.data?.email as string | undefined,
      name: userResponse.data?.name as string | undefined,
      taxId: userResponse.data?.tax_id as string | undefined,
      taxIdType: (userResponse.data?.tax_id_type || "eu_vat") as string | undefined,
    };
  } catch (error) {
    console.error("Failed to fetch user data for Stripe metadata:", error);
    // Return defaults so we don't block the payment flow
    return { createdAt: null, totalSpending: 0, accountType: "individual" as "individual" | "business" };
  }
}

/**
 * Updates the Stripe customer ID for the user with the given userID (in Orchestra)
 * @param userID - The ID of the user.
 * @param stripeCustomerID - The Stripe customer ID.
 * @returns The response from Orchestra.
 */
export async function updateStripeCustomerID(userID: string, stripeCustomerID: string) {
  const response = await OrchestraAdminClient.put("/stripe_customer_id", null, {
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
    return_url: process.env.NEXTAUTH_URL + "/billing",
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

  if ("deleted" in customer && customer.deleted) {
    return null;
  }


  if (!customer.invoice_settings?.default_payment_method) {
    return null;
  }

  const paymentMethodId = customer.invoice_settings.default_payment_method as string;


  return paymentMethodId;
}


/**
 * Creates a new Stripe checkout session for the given customer ID and returns the session URL.
 * @param customerID - The Stripe customer ID of the user.
 * @returns The URL of the created checkout session.
 */
export async function createCheckoutSession(userID: string, customerID: string): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  // 1. Fetch user data from Orchestra
  const { createdAt, totalSpending, accountType, email, name, taxId, taxIdType } = await getUserData(userID);

  // 2. Calculate enriched metadata fields
  let accountAgeDays = 0;
  if (createdAt) {
    const creationDate = new Date(createdAt);
    const today = new Date();
    accountAgeDays = Math.round((today.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const isRepeatCustomer = totalSpending > 0;

  console.log("[Checkout] user", userID, "accountType", accountType);

  let rawPriceOrProductId =
    accountType === "business"
      ? process.env.STRIPE_PRICE_ID_BUSINESS
      : process.env.STRIPE_PRICE_ID_PERSONAL;

  console.log("[Checkout] raw price/product env value:", rawPriceOrProductId);

  if (!rawPriceOrProductId) {
    throw new Error(
      `Missing Stripe price/product ID environment variable for ${accountType} account. Ensure STRIPE_PRICE_ID_${
        accountType === "business" ? "BUSINESS" : "PERSONAL"
      } is set.`
    );
  }

  let priceId: string;
  if (rawPriceOrProductId.startsWith("prod_")) {
    // Convert product ID to its first active price ID
    const pricesForProduct = await stripeClient.prices.list({ product: rawPriceOrProductId });
    const activePrice = pricesForProduct.data.find((p) => p.active);
    if (!activePrice) {
      throw new Error(
        `No active prices found for product ID ${rawPriceOrProductId}. Please create a price in Stripe or provide a price_ ID instead.`
      );
    }
    priceId = activePrice.id;
  } else {
    priceId = rawPriceOrProductId;
  }

  const price = await stripeClient.prices.retrieve(priceId);
  const credits_purchased = (price.unit_amount || 0) / 100; // Assuming $1 = 1 credit, and unit_amount is in cents.

  async function buildSession(custId?: string) {
    return await stripeClient.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      automatic_tax: {
        enabled: true,
      },
      customer_update: {
        address: "auto",
        ...(accountType === "business" && { name: "auto" }),
      },
      customer: custId,
      client_reference_id: userID,
      success_url: `${process.env.NEXTAUTH_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/billing`,
      billing_address_collection: "required",
      tax_id_collection: accountType === "business" ? { enabled: true } : undefined,
      payment_method_options: {
        card: {
          request_three_d_secure: "any",
        },
      },
      payment_intent_data: {
        metadata: {
          user_id: userID,
          credits_purchased: String(credits_purchased),

          // Enriched metadata
          user_total_spend: String(totalSpending),
          user_account_age_days: String(accountAgeDays),
          user_is_repeat_customer: String(isRepeatCustomer),
        },
      },
    });
  }

  let checkoutSession;
  async function ensureTaxId(custId: string) {
    if (accountType === "business" && taxId) {
      // Check existing tax IDs first to avoid duplicates
      const existing = await stripeClient.customers.listTaxIds(custId);
      const alreadyExists = existing.data.some((t: any) => t.value === taxId);
      if (!alreadyExists) {
        try {
          await stripeClient.customers.createTaxId(custId, {
            type: (taxIdType || "eu_vat") as any,
            value: taxId,
          });
        } catch (e) {
          console.warn("Failed to create tax ID for customer", e);
        }
      }
    }
  }

  try {
    if (customerID) {
      await ensureTaxId(customerID);
    }
    checkoutSession = await buildSession(customerID);
  } catch (err: any) {
    // If the provided customerID is invalid/missing in Stripe, create new customer and retry once
    if (
      err?.code === "resource_missing" &&
      err?.param === "customer" &&
      (err?.message?.includes("No such customer") || err?.raw?.message?.includes("No such customer"))
    ) {
      const newCustomerId = await ensureStripeCustomer({
        userId: userID,
        email: email || "",
        name: name || email || "User",
        // provide tax info if business
        taxId: accountType === "business" ? taxId : undefined,
        taxIdType: accountType === "business" ? taxIdType : undefined,
      });
      checkoutSession = await buildSession(newCustomerId);
    } else {
      throw err;
    }
  }

  if (!checkoutSession.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return checkoutSession.url;
}


  /**
   * Retrieves the list of card fingerprints associated with a given Stripe customer ID.
   * @param customerID - The Stripe customer ID of the user.
   * @returns An array of card fingerprints associated with the user's customer ID.
   * The response will have a status of 401 if the user is not authenticated,
   * 404 if the user does not have a Stripe customer ID, or 500 if there was
   * an error retrieving the user's payment methods.
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
    throw new Error("Stripe is not initialized. Check your environment variables.");
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  // 1. Check Orchestra for existing stripe_customer_id
  const billingDetails = await (await import("@/lib/user/billing/billing")).getUserBillingDetails(userId);
  let customerId = billingDetails[0]?.stripe_customer_id;

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
      console.warn("Failed to update Stripe customer", customerId, e);
    }
  }

  // 4. Handle tax ID
  if (clearTaxInfo) {
    try {
      const existing = await stripeClient.customers.listTaxIds(customerId);
      console.log('[Stripe] Existing tax IDs to clear:', existing.data.map(t => ({ id: t.id, value: t.value, type: t.type })));
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
          type: (taxIdType || "eu_vat") as any,
          value: taxId,
        });
      }
    } catch (e) {
      console.warn("Failed to ensure tax ID for customer", e);
    }
  }

  return customerId;
}