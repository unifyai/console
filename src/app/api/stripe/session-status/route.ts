import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * Returns the status of a Stripe Checkout session.
 *
 * Delegates to the backend GET /v0/billing/checkout-status endpoint which
 * handles Stripe interaction and ownership verification. The frontend no
 * longer needs the Stripe SDK or secret key for this operation.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const client = await getOrchestraUserClient(user.apiKey);
    const response = await client.get('/billing/checkout-status', {
      params: { session_id: sessionId },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error(`Error retrieving checkout session ${sessionId}:`, error?.response?.data || error);
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.detail || error?.message || 'Error retrieving session';
    return NextResponse.json({ error: detail }, { status });
  }
}
