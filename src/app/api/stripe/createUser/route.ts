

import { NextRequest, NextResponse } from 'next/server';
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
    
    const email = user.email;
    const name = user.name + " " + user.lastName;

    const customerID = await createNewStripeCustomer(email, name);
    
    if (!customerID) {
        return NextResponse.json({ error: 'User email or name not found' }, { status: 404 });
    }

    return NextResponse.json({ customerID: customerID });
}
