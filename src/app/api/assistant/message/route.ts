import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import type { Attachment } from '@/types/assistants/chat';

export async function POST(request: NextRequest) {
  const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
  if (!ADMIN_KEY) {
    console.error('[API /api/assistant/message] ORCHESTRA_ADMIN_KEY is not set.');
    return internalError('ORCHESTRA_ADMIN_KEY not set');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return badRequest('Invalid JSON body');
  }

  // Transform from snake_case to camelCase (support both formats)
  const normalizedBody = snakeToCamelObject<{
    assistantId?: string | number;
    contactId?: string | number;
    message?: string;
    body?: string;
    attachments?: Attachment[];
  }>(requestBody);

  // Support both 'message' and 'body' fields
  const { assistantId, contactId, attachments } = normalizedBody;
  const message = normalizedBody.message || normalizedBody.body;

  // Allow sending if there's a message OR attachments
  const hasContent = message || (attachments && attachments.length > 0);

  if (!assistantId) {
    return badRequest('Missing assistantId');
  }

  if (!hasContent) {
    return badRequest('Missing message or attachments');
  }

  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const isLocal = orchestraUrl.includes('localhost') || orchestraUrl.includes('127.0.0.1');
  const isStaging = orchestraUrl.includes('staging') || isLocal;

  // In local dev, skip the actual message dispatch to avoid polluting staging
  // assistants. Uploads already went through; this just acknowledges the message.
  if (isLocal) {
    return NextResponse.json(
      { info: 'Message accepted (local dev — dispatch skipped).' },
      { status: 202 }
    );
  }

  const webhookUrl = `https://unity-adapters-${isStaging ? 'staging-' : ''}ky4ja5fxna-uc.a.run.app/unify/message`;

  const payload = camelToSnakeObject({
    assistantId,
    contactId,
    body: message || '',
    attachments: attachments || [],
  });

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
        { detail: `Webhook error: ${errorText}` },
        { status: webhookResponse.status }
      );
    }

    return NextResponse.json(
      { info: 'Message sent to assistant for processing.' },
      { status: 202 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/assistant/message] Error calling webhook:', errorMessage);
    return NextResponse.json(
      { detail: `Webhook connection error: ${errorMessage}` },
      { status: 502 }
    );
  }
}
