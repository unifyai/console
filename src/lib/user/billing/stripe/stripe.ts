"use server";

import { stripe } from "@/lib/user/billing/stripe/stripe-instance";
import { OrchestraAdminClient } from "@/lib/orchestra/orchestra-client";


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
 * Updates the Stripe customer ID for the user with the given userID.
 * @param userID - The ID of the user.
 * @param stripeCustomerID - The Stripe customer ID.
 * @returns The response from Orchestra.
 */
export async function updateStripeCustomerID(userID: string, stripeCustomerID: string) {
  const response = await OrchestraAdminClient.post("/stripe_customer_id", null, {
    params: { id: userID, stripe_customer_id: stripeCustomerID },
  });
  return response.data
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
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "pay",
    line_items: [{
      price: process.env.STRIPE_PRICE_ID as string,
      quantity: 1,
    }],
    customer: customerID,
    success_url: `${process.env.NEXTAUTH_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing`,
    billing_address_collection: "required",
    payment_method_types: ["card"],
    payment_intent_data: {
      setup_future_usage: "off_session",
    },
    metadata: {
      userID: userID,
    }
  });

  if (!checkoutSession.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return checkoutSession.url;
}

/**
 * Retrieves a list of card fingerprints associated with a given Stripe customer ID.
 * @param customerID - The Stripe customer ID of the user.
 * @returns A list of card fingerprints.
 */
export async function getStripeFingerprints(customerID : string){
  if (!stripe) {
    throw new Error('Stripe is not initialized. Check your environment variables.');
  }

  const paymentMethods = await stripe.customers.listPaymentMethods(customerID);

  return paymentMethods.data.map((entry:any) => entry.card.fingerprint);
}