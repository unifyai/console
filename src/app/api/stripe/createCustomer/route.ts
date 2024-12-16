

import { NextRequest, NextResponse } from 'next/server';
import { createNewStripeCustomer, updateStripeCustomerID } from '@/lib/user/billing/stripe/stripe';
import { getCurrentUser } from '@/lib/user/user';
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

    if (billingDetails[0].stripe_customer_id) {
        return NextResponse.json({ error: "User already has a Stripe customer ID" }, { status: 400 });
    }
    
    const email = user.email;
    const name = user.name + " " + user.lastName;


    const customerID = await createNewStripeCustomer(email, name);
    
    if (!customerID) {
        console.error('createCustomer: Unable to create Stripe customer');
        return NextResponse.json({ error: 'Unable to create Stripe customer' }, { status: 500 });
    }


    const updateStripeCustomerIDResponse = await updateStripeCustomerID(user.id, customerID);

    if (!updateStripeCustomerIDResponse) {
        console.error('createCustomer: Unable to update Stripe customer ID');
        return NextResponse.json({ error: 'Unable to update Stripe customer ID' }, { status: 500 });
    }


    return NextResponse.json({ message: 'Stripe customer created successfully' }, { status: 200 });
}
