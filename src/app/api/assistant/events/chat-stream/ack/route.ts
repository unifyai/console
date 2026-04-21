/**
 * Chat stream client-side ACK endpoint.
 *
 * Companion to the SSE route at `../route.ts`. The SSE route intentionally
 * does NOT ack messages on enqueue; it keeps them leased until the browser
 * confirms it actually rendered the message, at which point the browser
 * POSTs here with `{ assistantId, contactId, ackId }` and we ack upstream
 * via the Pub/Sub REST API.
 *
 * Why REST and not the streaming-pull client
 * ------------------------------------------
 * The `Message` object returned by the streaming-pull client lives in the
 * memory of the SSE function invocation. This ack endpoint runs as a
 * separate serverless invocation, so it can't reach that object. Pub/Sub
 * ack IDs are opaque server-side tokens that can be acknowledged from any
 * client, so we resolve the subscription URL and hit `:acknowledge`
 * directly — same approach the pre-consolidation per-assistant ack route
 * used.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, getTopicName, getPubSubApiBase } from '@/lib/pubsub/ephemeral-subscription';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assistantId, contactId, ackId } = body ?? {};
  if (!assistantId || !contactId || !ackId) {
    return NextResponse.json(
      { error: 'assistantId, contactId and ackId required' },
      { status: 400 }
    );
  }

  try {
    const { client, projectId } = await getAuthClient();
    const topicName = getTopicName(String(assistantId));
    const subscriptionName = `${topicName}-chat-${contactId}`;
    const subscriptionUrl = `${getPubSubApiBase()}/projects/${projectId}/subscriptions/${subscriptionName}`;

    await client.request({
      url: `${subscriptionUrl}:acknowledge`,
      method: 'POST',
      data: { ackIds: [ackId] },
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // A 404 here means the subscription was GC'd (31-day idle expiration)
    // or the assistant was deleted — the client's view is already stale so
    // there's nothing useful to do on either side.
    const status = err?.response?.status ?? err?.status ?? 500;
    console.error('[Chat Stream ACK] Error:', { status, message: err?.message });
    if (status === 404) {
      return NextResponse.json({ ok: true, stale: true });
    }
    return NextResponse.json({ error: 'ACK failed' }, { status: 500 });
  }
}
