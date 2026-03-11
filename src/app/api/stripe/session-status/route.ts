import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * Returns the status of a Stripe Checkout session.
 *
 * Delegates to the backend GET /v0/billing/checkout-status endpoint which
 * handles Stripe interaction and ownership verification. The frontend no
 * longer needs the Stripe SDK or secret key for this operation.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const client = await getOrchestraUserClient(apiKey);
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
