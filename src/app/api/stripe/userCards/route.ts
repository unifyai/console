import { NextRequest, NextResponse } from 'next/server';
import { getStripeFingerprints } from '@/lib/user/billing/stripe/stripe';
import { getCurrentUser } from '@/lib/user/user';
import { getUserBillingDetails } from '@/lib/user/billing/billing';


/**
 * Returns the list of cards associated with the user as an array of their
 * fingerprint IDs.
 * @param request - The NextRequest object.
 * @returns A JSON response containing an array of card fingerprint IDs.
 * The response will have a status of 401 if the user is not authenticated,
 * 404 if the user does not have a Stripe customer ID, or 500 if there was
 * an error retrieving the user's cards.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const billingDetails = await getUserBillingDetails(user.id);
  const customerID = billingDetails[0].stripeCustomerId;

  if (!customerID) {
    return NextResponse.json({ error: "No customer ID found" }, { status: 404 });
  }

  try {
    const cardFingerprints = await getStripeFingerprints(customerID);
    return NextResponse.json({ cardFingerprints });
  } catch (error) {
    console.error('Error retrieving user cards:', error);
    return NextResponse.json({ error: 'Error retrieving user cards' }, { status: 500 });
  }
}