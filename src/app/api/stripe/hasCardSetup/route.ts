import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getStripeFingerprints } from '@/lib/user/billing/stripe/stripe';
import { getUserBillingDetails } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const billingDetails = await getUserBillingDetails(user.id);

  if (!billingDetails) {
    return NextResponse.json({ error: "No billing details found" }, { status: 404 });
  }


  const customerID = billingDetails[0].stripeCustomerId;

  if (!customerID) {
    return NextResponse.json({ error: "No customer ID found" }, { status: 404 });
  }


  try {
    const cardFingerprints = await getStripeFingerprints(customerID);
    
    
    if (cardFingerprints.length > 0) {
      return NextResponse.json({ hasCardSetup: true });
    } else {
      return NextResponse.json({ hasCardSetup: false });
    }
    
  } catch (error) {
    return NextResponse.json({ error: 'Error retrieving user cards' }, { status: 500 });
  }
}
