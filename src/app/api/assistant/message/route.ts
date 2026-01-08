import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject } from '@/utils/casing';

export async function POST(request: NextRequest) {
  const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
  if (!ADMIN_KEY) {
    console.error('[API /api/assistant/message] ORCHESTRA_ADMIN_KEY is not set.');
    return NextResponse.json({ detail: 'Server configuration error.' }, { status: 500 });
  }

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  const { assistantId, contactId, message } = requestBody;

  if (!assistantId || !message) {
    return NextResponse.json({ detail: "Missing 'assistantId' or 'message'" }, { status: 400 });
  }

  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const isStaging = orchestraUrl.includes('staging');

  const webhookUrl = `https://unity-adapters-${isStaging ? 'staging-' : ''}ky4ja5fxna-uc.a.run.app/unify/message`;

  // Transform to snake_case for external API
  const payload = camelToSnakeObject({ assistantId, contactId, body: message });

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(
        `[API /api/assistant/message] Webhook error (${webhookResponse.status}): ${errorText}`
      );
      return NextResponse.json(
        { detail: `Failed to send message to assistant: ${errorText}` },
        { status: webhookResponse.status }
      );
    }

    return NextResponse.json(
      { info: 'Message sent to assistant for processing.' },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[API /api/assistant/message] Error calling webhook:', error.message);
    return NextResponse.json(
      { detail: 'Failed to connect to messaging service.', errorDetails: error.message },
      { status: 503 }
    );
  }
}
