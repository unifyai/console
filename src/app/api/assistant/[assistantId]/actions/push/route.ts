/**
 * Local Development Push Endpoint for Actions Streaming
 *
 * Accepts pre-shaped SSE events via POST and publishes them to the in-memory
 * event bus, where active SSE connections pick them up instantly.
 *
 * Only available in local development mode (no COMMS_SERVICE_ACCOUNT_CREDENTIALS).
 * In production, events flow through GCP Pub/Sub instead.
 *
 * Request body: a single event or an array of events. Each event should be in
 * the final SSE shape: { type, data: { id, ts, entries: { ... } } }.
 *
 * Usage from the simulation script:
 *   POST http://localhost:3333/api/assistant/1/actions/push
 *   Content-Type: application/json
 *   { "type": "ManagerMethod", "data": { "id": 1, "ts": "...", "entries": { ... } } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasCredentials, publish } from '@/lib/pubsub/local-event-bus';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  if (hasCredentials()) {
    return NextResponse.json(
      { detail: 'Push endpoint is only available in local development mode.' },
      { status: 403 }
    );
  }
  if (!assistantId) {
    return NextResponse.json({ detail: 'Assistant ID is required.' }, { status: 400 });
  }

  const body = await request.json();
  const events: Array<Record<string, unknown>> = Array.isArray(body) ? body : [body];

  for (const event of events) {
    publish(assistantId, event);
  }

  return NextResponse.json({ ok: true, published: events.length });
}
