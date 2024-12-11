import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { createCheckoutSession } from '@/lib/user/billing/stripe/stripe';
import { getUserBillingDetails } from '@/lib/user/billing/billing';
import { stripe } from '@/lib/user/billing/stripe/stripe-instance';
import { url } from 'inspector';



  /**
   * Returns a Stripe checkout session for the authenticated user.
   * If the user is not authenticated, returns a 404 error.
   * If Stripe is not initialized, returns a 400 error.
   * If the user does not have a Stripe customer ID, returns a 404 error.
   * If there was an error creating the checkout session, returns a 500 error.
   * 
   * @param request - The NextRequest object.
   * @returns A JSON response containing the checkout session object.
   */
export async function GET(request: NextRequest) {

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not initialized. Check your environment variables.' }, { status: 400 });
  }
  
  const billingDetails = await getUserBillingDetails(user.id);
  const customerID = billingDetails[0].stripe_customer_id;

  if (!customerID) {
    return NextResponse.json({ error: 'No customer ID found' }, { status: 404 });
  }

  try {  
    const checkoutSession = await createCheckoutSession(user.id, customerID);
    return NextResponse.json({ url: checkoutSession });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Error creating checkout session' }, { status: 500 });
  }
}

