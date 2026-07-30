/**
 * API Route: POST /api/assistant/[assistantId]/multiplayer
 *
 * Proxies to Orchestra: POST /v0/assistant/{id}/multiplayer
 *
 * The one-way coordinator multiplayer flip: applies the twin's outward
 * identity (name, voice, optional avatar), retires shared-pool contacts,
 * and provisions the dedicated alias email server-side.
 *
 * Request Body:
 *   {
 *     firstName: string,
 *     surname?: string | null,
 *     voiceId: string,
 *     voiceProvider: string,
 *     profilePhoto?: string | null
 *   }
 *
 * Response: the updated assistant record (camelCase), with isMultiplayer set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { assistantId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const { firstName, voiceId, voiceProvider } = body ?? {};
  if (typeof firstName !== 'string' || !firstName.trim()) {
    return badRequest('Missing required field: firstName');
  }
  if (typeof voiceId !== 'string' || !voiceId.trim()) {
    return badRequest('Missing required field: voiceId');
  }
  if (typeof voiceProvider !== 'string' || !voiceProvider.trim()) {
    return badRequest('Missing required field: voiceProvider');
  }

  try {
    const snakeCaseBody = camelToSnakeObject({
      firstName: firstName.trim(),
      surname: typeof body.surname === 'string' && body.surname.trim() ? body.surname.trim() : null,
      voiceId,
      voiceProvider,
      profilePhoto: body.profilePhoto || null,
    });

    const response = await fetch(`${ORCHESTRA_URL}/v0/assistant/${assistantId}/multiplayer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to enable multiplayer mode' }, {
        status: response.status,
      });
    }

    const info = data && typeof data === 'object' && 'info' in data ? data.info : data;
    return NextResponse.json(snakeToCamelObject(info), { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/assistant/[assistantId]/multiplayer POST] Error:',
      e instanceof Error ? e.message : e
    );
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
