import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getStripeFingerprints } from '@/lib/user/billing/stripe/stripe';
import { getUserBillingDetails } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  console.log('GET /api/stripe/hasCardSetup route called')
  const user = await getCurrentUser();

  if (!user) {
    console.log('User not found')
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  console.log('User found:', user)

  const billingDetails = await getUserBillingDetails(user.id);

  if (!billingDetails) {
    console.log('No billing details found')
    return NextResponse.json({ error: "No billing details found" }, { status: 404 });
  }

  console.log('Billing details found:', billingDetails)

  const customerID = billingDetails[0].stripe_customer_id;

  if (!customerID) {
    console.log('No customer ID found')
    return NextResponse.json({ error: "No customer ID found" }, { status: 404 });
  }

  console.log('Customer ID found:', customerID)

  try {
    const cardFingerprints = await getStripeFingerprints(customerID);
    
    console.log('Card fingerprints found:', cardFingerprints)
    
    if (cardFingerprints.length > 0) {
      console.log('Card setup found')
      return NextResponse.json({ hasCardSetup: true });
    } else {
      console.log('No card setup found')
      return NextResponse.json({ hasCardSetup: false });
    }
    
  } catch (error) {
    console.error('Error retrieving user cards:', error)
    return NextResponse.json({ error: 'Error retrieving user cards' }, { status: 500 });
  }
}
