import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

async function getAuthClient() {
    const credentialsValue = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
    if (!credentialsValue) throw new Error('Missing credentials');

    let credentials;
    try { credentials = JSON.parse(credentialsValue); }
    catch (e) { credentials = JSON.parse(fs.readFileSync(credentialsValue, 'utf8')); }

    const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/pubsub'],
        projectId: credentials.projectId
    });

    return { client: await auth.getClient(), projectId: credentials.projectId };
}

export async function POST(
    request: NextRequest,
    { params }: { params: { assistantId: string } }
) {
    const { assistantId } = params;
    if (!assistantId) return NextResponse.json({ detail: 'AssistantId required' }, { status: 400 });

    let body: any = {};
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 });
    }

    const { ackId } = body;

    if (!ackId) return NextResponse.json({ detail: 'Missing ackId' }, { status: 400 });

    try {
        const { client, projectId } = await getAuthClient();
        const orchestraUrl = process.env.ORCHESTRA_URL || "";
        const isStaging = orchestraUrl.includes("staging");

        const subscriptionName = `unity-${assistantId}${isStaging ? '-staging' : ''}-outbound-sub`;
        const subscriptionUrl = `https://pubsub.googleapis.com/v1/projects/${projectId}/subscriptions/${subscriptionName}`;

        await client.request({
            url: `${subscriptionUrl}:acknowledge`,
            method: 'POST',
            data: { ackIds: [ackId] }
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[ACK route] Error acknowledging:', err?.message || err);
        return NextResponse.json({ detail: 'ACK failed', error: err?.message || String(err) }, { status: 500 });
    }
}