import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/options';
import { getUserCards } from '@/lib/user/billing/free-credits';
import { getUserBillingDetails } from '@/lib/user/billing/billing';
import { createNewStripeCustomer } from '@/lib/user/billing/stripe/stripe';
import { getCurrentUser } from '@/lib/user/user';


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

  try {
    const billingDetails = await getUserBillingDetails(user.id);

    var customerID = billingDetails[0].stripe_customer_id;

    if (!customerID) {
      const session = await getServerSession(authOptions);

      if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const email = session.user.email;
      const name = session.user.name;
      if (email && name) {
        customerID = await createNewStripeCustomer(email, name);
      }
      else {
        return NextResponse.json({ error: 'User email or name not found' }, { status: 404 });
      }
    }

    const cardFingerprints = await getUserCards(customerID);

    return NextResponse.json({ cardFingerprints });
  } catch (error) {
    console.error('Error retrieving user cards:', error);
    return NextResponse.json({ error: 'Error retrieving user cards' }, { status: 500 });
  }
}