/**
 * Local Development Push Endpoint for Billing Events
 *
 * Accepts billing events via POST and publishes them to the in-memory
 * event bus, where active billing SSE connections pick them up instantly.
 *
 * Only available in local development mode (no COMMS_SERVICE_ACCOUNT_CREDENTIALS
 * and no PUBSUB_EMULATOR_HOST). In production, events flow through GCP Pub/Sub.
 *
 * Usage:
 *   POST http://localhost:3000/api/billing/events/push
 *   Content-Type: application/json
 *   { "billing_account_id": 1, "event_type": "credits_exhausted", "balance": -0.42 }
 *
 *   POST http://localhost:3000/api/billing/events/push
 *   Content-Type: application/json
 *   { "billing_account_id": 1, "event_type": "credits_restored", "balance": 25.00 }
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasCredentials, publish } from '@/lib/pubsub/local-event-bus';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (hasCredentials()) {
    return NextResponse.json(
      { detail: 'Push endpoint is only available in local development mode.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const billingAccountId = body.billing_account_id;

  if (!billingAccountId) {
    return NextResponse.json({ detail: 'billing_account_id is required.' }, { status: 400 });
  }

  const busKey = `billing-${billingAccountId}`;
  publish(busKey, body);

  return NextResponse.json({ ok: true, published: 1 });
}
