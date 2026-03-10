import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * Returns a Stripe checkout session URL for the active workspace's billing account.
 *
 * Delegates to the backend POST /v0/billing/checkout-session endpoint which
 * handles all Stripe interactions. The frontend no longer needs the Stripe SDK
 * or secret key for this operation.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const client = await getOrchestraUserClient(user.apiKey);
    const response = await client.post('/billing/checkout-session');

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error creating checkout session:', error?.response?.data || error);
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.detail || 'Error creating checkout session';
    return NextResponse.json({ error: detail }, { status });
  }
}
