import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/user/billing/stripe/stripe-instance';
import { getCurrentUser } from '@/lib/user/user';
import { getUserBillingDetails } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not initialized' }, { status: 500 });
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  try {
    const billingDetails = await getUserBillingDetails(user.id);
    const customerID = billingDetails[0]?.stripeCustomerId;

    if (!customerID) {
      return NextResponse.json({ error: 'User has no Stripe customer ID' }, { status: 404 });
    }

    const session = await stripeClient.checkout.sessions.retrieve(sessionId);

    // Security check: Make sure the session belongs to the logged-in user.
    if (session.customer !== customerID) {
      return NextResponse.json({ error: 'Checkout session does not belong to the authenticated user' }, { status: 403 });
    }

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
    });

  } catch (error: any) {
    console.error(`Error retrieving checkout session ${sessionId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 