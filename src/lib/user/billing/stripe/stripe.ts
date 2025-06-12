"use server";

import { stripe } from "@/lib/user/billing/stripe/stripe-instance";
import { OrchestraAdminClient } from "@/lib/orchestra/orchestra-client";


/**
 * Fetches user data required for enriched metadata.
 * @param userID - The ID of the user.
 * @returns An object containing user creation date and total spending.
 */
async function getUserData(userID: string) {
  try {
    const userResponse = await OrchestraAdminClient.get(`/users/${userID}`);
    const spendingResponse = await OrchestraAdminClient.get(`/users/${userID}/total_spending`);

    return {
      createdAt: userResponse.data?.created_at, // e.g., '2023-01-01T12:00:00Z'
      totalSpending: spendingResponse.data?.total_spending || 0, // e.g., 150.75
    };
  } catch (error) {
    console.error("Failed to fetch user data for Stripe metadata:", error);
    // Return defaults so we don't block the payment flow
    return { createdAt: null, totalSpending: 0 };
  }
}

/**
 * Creates a new Stripe customer with the specified email and name.
 * @param email - The email address of the customer.
 * @param name - The name of the customer.
 * @returns The ID of the created Stripe customer.
 */
export async function createNewStripeCustomer(email: string, name: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }
  const customer = await stripe.customers.create({
    email: email,
    name: name,
  });
  return customer.id;
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
  const billingPortalSession = await stripe.billingPortal.sessions.create({
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
  const customer = await stripe.customers.retrieve(customerID);

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

  // 1. Fetch user data from Orchestra
  const { createdAt, totalSpending } = await getUserData(userID);

  // 2. Calculate enriched metadata fields
  let accountAgeDays = 0;
  if (createdAt) {
    const creationDate = new Date(createdAt);
    const today = new Date();
    accountAgeDays = Math.round((today.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const isRepeatCustomer = totalSpending > 0;

  const priceId = process.env.STRIPE_PRICE_ID as string;
  const price = await stripe.prices.retrieve(priceId);
  const credits_purchased = (price.unit_amount || 0) / 100; // Assuming $1 = 1 credit, and unit_amount is in cents.

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "pay",
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    customer: customerID,
    client_reference_id: userID,
    success_url: `${process.env.NEXTAUTH_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing`,
    billing_address_collection: "required",
    payment_method_options: {
      card: {
        request_three_d_secure: "any",
      }
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

  try {
    const paymentMethods = await stripe.customers.listPaymentMethods(customerID);

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