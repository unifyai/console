/**
 * API route for seeding a Coordinator opener transcript row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrchestraClient } from '@/lib/orchestra/client';
import { badRequest, getApiKeyFromRequest, internalError, unauthorized } from '../_utils/auth';

interface CoordinatorTranscriptSeedRequest {
  coordinatorId?: unknown;
  content?: unknown;
}

interface CoordinatorTranscriptSeedInfo {
  logEventId?: number;
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  let body: CoordinatorTranscriptSeedRequest;
  try {
    body = (await request.json()) as CoordinatorTranscriptSeedRequest;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (
    !(
      (typeof body.coordinatorId === 'string' && body.coordinatorId.trim().length > 0) ||
      typeof body.coordinatorId === 'number'
    )
  ) {
    return badRequest('coordinatorId is required');
  }
  if (typeof body.content !== 'string' || body.content.trim().length === 0) {
    return badRequest('content is required');
  }

  const coordinatorId = Number(body.coordinatorId);
  if (!Number.isInteger(coordinatorId)) {
    return badRequest('coordinatorId must be numeric');
  }

  const client = createOrchestraClient(apiKey);
  const { data, error, response } = await client.POST(
    '/v0/assistant/{coordinator_id}/transcript-seed',
    {
      params: { path: { coordinator_id: coordinatorId } },
      body: { content: body.content.trim() },
    }
  );

  if (error) {
    const detail =
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to seed Coordinator opener';
    if (response?.status === 401) return unauthorized(detail);
    return NextResponse.json({ error: detail }, { status: response?.status || 500 });
  }

  const info = data?.info as CoordinatorTranscriptSeedInfo | undefined;
  const logEventId = info?.logEventId;
  if (typeof logEventId !== 'number')
    return internalError('Coordinator opener seed response was invalid');

  return NextResponse.json({ logEventId });
}
