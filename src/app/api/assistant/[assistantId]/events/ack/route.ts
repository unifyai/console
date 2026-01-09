import { NextRequest, NextResponse } from 'next/server';
import { badRequest, internalError } from '../../../../_utils/auth';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

async function getAuthClient() {
  const credentialsValue = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credentialsValue) throw new Error('Missing credentials');

  let credentials;
  try {
    credentials = JSON.parse(credentialsValue);
  } catch (e) {
    credentials = JSON.parse(fs.readFileSync(credentialsValue, 'utf8'));
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/pubsub'],
    projectId: credentials.projectId,
  });

  return { client: await auth.getClient(), projectId: credentials.projectId };
}

export async function POST(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const { assistantId } = params;
  if (!assistantId) return badRequest('AssistantId required');

  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {
    return badRequest('Invalid JSON');
  }

  const { ackId } = body;

  if (!ackId) return badRequest('Missing ackId');

  try {
    const { client, projectId } = await getAuthClient();
    const orchestraUrl = process.env.ORCHESTRA_URL || '';
    const isStaging = orchestraUrl.includes('staging');

    const subscriptionName = `unity-${assistantId}${isStaging ? '-staging' : ''}-outbound-sub`;
    const subscriptionUrl = `https://pubsub.googleapis.com/v1/projects/${projectId}/subscriptions/${subscriptionName}`;

    await client.request({
      url: `${subscriptionUrl}:acknowledge`,
      method: 'POST',
      data: { ackIds: [ackId] },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[ACK route] Error acknowledging:', err?.message || err);
    return internalError('ACK failed');
  }
}
