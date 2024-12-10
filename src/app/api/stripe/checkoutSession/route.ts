import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getSession } from '@/lib/user/user';
import { createCheckoutSession, createNewStripeCustomer } from '@/lib/user/billing/stripe/stripe';
import { getUserBillingDetails } from '@/lib/user/billing/billing';

// Import the Stripe instance
import { stripe } from '@/lib/user/billing/stripe/stripe-instance';


/**
 * Handles a GET request to the /stripe/checkoutSession endpoint.
 * 
 * This endpoint creates a new Stripe checkout session for the user with the given customer ID.
 * The checkout session is used for embedding a payment form on the frontend.
 * 
 * @param request The NextRequest object.
 * @returns The created checkout session object or an error response.
 */
export async function GET(request: NextRequest) {

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  
  try {
    if (!stripe) {
      throw new Error('Stripe is not initialized. Check your environment variables.');
    }

    const billingDetails = await getUserBillingDetails(user.id);
    var customerID = billingDetails[0].stripe_customer_id;

    if (!customerID) {
      const session = await getSession();

      if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const email = session.user.email;
      const name = session.user.name;
      if (!email || !name) {
        return NextResponse.json({ error: 'Missing email or name' }, { status: 400 });
      }
      customerID = await createNewStripeCustomer(email, name);
    }
      
    const checkoutSession = await createCheckoutSession(customerID);
    return NextResponse.json(checkoutSession);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Error creating checkout session' }, { status: 500 });
  }
}

