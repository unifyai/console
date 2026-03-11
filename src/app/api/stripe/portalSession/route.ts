import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * Retrieves the Stripe customer portal session URL for the active workspace.
 *
 * Delegates to the backend POST /v0/billing/portal-session endpoint which
 * handles all Stripe interactions. The frontend no longer needs the Stripe SDK
 * or secret key for this operation.
 *
 * @param request - The NextRequest object.
 * @returns A JSON response containing the customer portal session URL or an error message.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/portal-session');

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error creating portal session:', error?.response?.data || error);
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.detail || 'Error creating portal session';
    return NextResponse.json({ error: detail }, { status });
  }
}
