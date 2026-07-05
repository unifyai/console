import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../_utils/auth';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { getAdaptersBaseUrl } from '@/utils/assistants/api-utils';
import { mockSimulationEnabled } from '@/lib/simulation/config';

export async function POST(request: NextRequest) {
  if (mockSimulationEnabled()) {
    return NextResponse.json({ info: 'Reaction accepted (mock simulation).' }, { status: 202 });
  }

  const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
  if (!ADMIN_KEY) {
    console.error('[API /api/assistant/message/reaction] ORCHESTRA_ADMIN_KEY is not set.');
    return internalError('ORCHESTRA_ADMIN_KEY not set');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const normalizedBody = snakeToCamelObject<{
    assistantId?: string | number;
    contactId?: string | number;
    targetMessageId?: string | number;
    emoji?: string | null;
  }>(requestBody);

  const { assistantId, contactId, targetMessageId, emoji } = normalizedBody;

  if (!assistantId) {
    return badRequest('Missing assistantId');
  }
  if (contactId === undefined || contactId === null) {
    return badRequest('Missing contactId');
  }
  if (targetMessageId === undefined || targetMessageId === null) {
    return badRequest('Missing targetMessageId');
  }

  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const isLocal = orchestraUrl.includes('localhost') || orchestraUrl.includes('127.0.0.1');
  const localAdaptersUrl = process.env.LOCAL_ADAPTERS_URL;

  let adaptersBaseUrl: string;
  if (isLocal) {
    if (!localAdaptersUrl) {
      return NextResponse.json(
        {
          info: 'Reaction accepted (local dev — dispatch skipped). Set LOCAL_ADAPTERS_URL to dispatch to local adapters.',
        },
        { status: 202 }
      );
    }
    adaptersBaseUrl = getAdaptersBaseUrl({ localAdaptersUrl });
  } else {
    adaptersBaseUrl = getAdaptersBaseUrl();
  }

  const webhookUrl = `${adaptersBaseUrl}/unify/reaction`;
  const payload = camelToSnakeObject({
    assistantId,
    contactId,
    targetMessageId,
    emoji: emoji ?? null,
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
        `[API /api/assistant/message/reaction] Webhook error (${webhookResponse.status}): ${errorText}`
      );
      return NextResponse.json(
        { detail: `Webhook error: ${errorText}` },
        { status: webhookResponse.status }
      );
    }

    return NextResponse.json(
      { info: 'Reaction sent to assistant for processing.' },
      { status: 202 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/assistant/message/reaction] Error calling webhook:', errorMessage);
    return NextResponse.json(
      { detail: `Webhook connection error: ${errorMessage}` },
      { status: 502 }
    );
  }
}
