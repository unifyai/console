import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST: Subscribe the active workspace's self-serve account to a monthly
 * credit tier. Delegates to backend POST /v0/billing/subscribe.
 *
 * When the response carries a `hostedInvoiceUrl` the customer must
 * complete the first payment on the Stripe-hosted invoice page (the
 * console has no Stripe.js, so the client redirects there).
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { templateId } = body;

    if (typeof templateId !== 'number') {
      return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });
    }

    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/subscribe', { templateId });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error subscribing:', error?.response?.data || error);
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.detail || 'Error subscribing';
    return NextResponse.json({ error: detail }, { status });
  }
}
