import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { loggedFetch, logIncomingRequest } from '@/lib/logging/fetch';

export async function POST(request: NextRequest) {
  const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
  if (!ADMIN_KEY) {
    console.error('[API /api/assistant/message] ORCHESTRA_ADMIN_KEY is not set.');
    return logIncomingRequest(
      request,
      'POST',
      '/api/assistant/message',
      500,
      'ORCHESTRA_ADMIN_KEY not set'
    );
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return logIncomingRequest(request, 'POST', '/api/assistant/message', 401, 'Unauthorized');
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return logIncomingRequest(request, 'POST', '/api/assistant/message', 400, 'Invalid JSON body');
  }

  // Log the incoming request body for debugging
  await logIncomingRequest(request, 'POST', '/api/assistant/message', null, null, requestBody);

  // Transform from snake_case to camelCase (support both formats)
  const normalizedBody = snakeToCamelObject<{
    assistantId?: string | number;
    contactId?: string | number;
    message?: string;
  }>(requestBody);
  const { assistantId, contactId, message } = normalizedBody;

  if (!assistantId || !message) {
    return logIncomingRequest(
      request,
      'POST',
      '/api/assistant/message',
      400,
      `Missing fields: assistantId=${!!assistantId}, message=${!!message}`
    );
  }

  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const isStaging = orchestraUrl.includes('staging');

  const webhookUrl = `https://unity-adapters-${isStaging ? 'staging-' : ''}ky4ja5fxna-uc.a.run.app/unify/message`;

  // Transform to snake_case for external API
  const payload = camelToSnakeObject({ assistantId, contactId, body: message });

  try {
    const webhookResponse = await loggedFetch(
      webhookUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      'UNITY_ADAPTERS'
    );

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(
        `[API /api/assistant/message] Webhook error (${webhookResponse.status}): ${errorText}`
      );
      return logIncomingRequest(
        request,
        'POST',
        '/api/assistant/message',
        webhookResponse.status,
        `Webhook error: ${errorText}`
      );
    }

    return NextResponse.json(
      { info: 'Message sent to assistant for processing.' },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[API /api/assistant/message] Error calling webhook:', error.message);
    return logIncomingRequest(
      request,
      'POST',
      '/api/assistant/message',
      500,
      `Connection error: ${error.message}`
    );
  }
}
