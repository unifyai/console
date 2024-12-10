import { NextRequest, NextResponse } from 'next/server';
import { getUserBillingDetails } from '@/lib/user/billing/billing';
import { createCustomerPortalSession } from '@/lib/user/billing/stripe/stripe';
import { createNewStripeCustomer } from '@/lib/user/billing/stripe/stripe';
import { getCurrentUser, getSession } from '@/lib/user/user';


/**
 * Retrieves the Stripe customer portal session URL for the authenticated user.
 * 
 * This function first authenticates the user through a server session.
 * If the user is not authenticated, it returns a 401 Unauthorized response.
 * Then, it fetches the user's ID and billing details to obtain the Stripe customer ID.
 * If the customer ID is not found, it returns a 404 error.
 * Finally, it creates a new customer portal session and returns the URL in the response.
 * 
 * @param request - The NextRequest object.
 * @returns A JSON response containing the customer portal session URL or an error message.
 */
export async function POST(request: NextRequest) {
  
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  
  const userID = user.id as string;
  
  try {
    const billingDetails = await getUserBillingDetails(userID);
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

    const portalSession = await createCustomerPortalSession(customerID);
    return NextResponse.json({ url: portalSession });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json({ error: 'Error creating portal session' }, { status: 500 });
  }
};
