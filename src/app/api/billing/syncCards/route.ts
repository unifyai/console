import { getCurrentUser } from "@/lib/user/user";
import { getUserBillingDetails, getUserCards, storeUserCard } from "@/lib/user/billing/billing";
import { NextRequest, NextResponse } from 'next/server';
import { getStripeFingerprints } from "@/lib/user/billing/stripe/stripe";


export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const billingDetails = await getUserBillingDetails(user.id);
  const customerID = billingDetails[0].stripe_customer_id;

  if (!customerID) {
    return NextResponse.json({ error: "No customer ID found" }, { status: 404 });
  }

  var stripeCardsResponse = getStripeFingerprints(customerID);
  var userCardsResponse = getUserCards(user.id);
  var [stripeCards, userCards] = await Promise.all([stripeCardsResponse, userCardsResponse]);

  // Create a set of user card fingerprints
  const userCardFingerprintSet = new Set(userCards.map((card:any) => card.fingerprint));

  // Find new cards (in Stripe but not in user's database)
  const newCards = stripeCards.filter((fingerprint:string) => !userCardFingerprintSet.has(fingerprint));

  for (const fingerprint of newCards) {
    try {
      await storeUserCard(user.id, fingerprint);
    } catch (error) {
      console.error('Error storing user card:', error);
    }
  }

  return NextResponse.json({success: true, });
}