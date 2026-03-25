import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthClient,
  getTopicName,
  getPubSubApiBase,
} from '@/lib/pubsub/ephemeral-subscription';

export async function POST(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const { assistantId } = params;
  if (!assistantId) {
    return NextResponse.json({ error: 'assistantId required' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { ackId, contactId } = body;
  if (!ackId || !contactId) {
    return NextResponse.json({ error: 'ackId and contactId required' }, { status: 400 });
  }

  try {
    const { client, projectId } = await getAuthClient();
    const topicName = getTopicName(assistantId);
    const subscriptionName = `${topicName}-chat-${contactId}`;
    const subscriptionUrl = `${getPubSubApiBase()}/projects/${projectId}/subscriptions/${subscriptionName}`;

    await client.request({
      url: `${subscriptionUrl}:acknowledge`,
      method: 'POST',
      data: { ackIds: [ackId] },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Chat ACK] Error:', err?.message || err);
    return NextResponse.json({ error: 'ACK failed' }, { status: 500 });
  }
}
