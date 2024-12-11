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

    //check if there are stripe fingerprints that are not in the user fingerprints
    const stripeCardsSet = new Set(stripeCards);
    const userCardsSet = new Set(userCards);

    const missingCards = Array.from(stripeCardsSet).filter((fingerprint) => !userCardsSet.has(fingerprint));

    for (const fingerprint of missingCards) {
    storeUserCard(user.id, fingerprint);
    }

    return NextResponse.json({ success: true });
  }

       