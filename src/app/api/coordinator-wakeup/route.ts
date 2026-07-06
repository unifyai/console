/**
 * API route for waking the Coordinator runtime early during onboarding.
 *
 * Proxies to Orchestra's ``/v0/assistant/{coordinator_id}/wakeup`` endpoint.
 * Best-effort: failures are logged but should not block Console navigation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getApiKeyFromRequest, unauthorized } from '../_utils/auth';

interface CoordinatorWakeupRequest {
  coordinatorId?: unknown;
}

interface CoordinatorWakeupInfo {
  coordinatorId?: string;
  attempted?: boolean;
}

interface OrchestraResponse {
  info?: CoordinatorWakeupInfo;
  detail?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  let body: CoordinatorWakeupRequest;
  try {
    body = (await request.json()) as CoordinatorWakeupRequest;
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

  const coordinatorId = Number(body.coordinatorId);
  if (!Number.isInteger(coordinatorId)) {
    return badRequest('coordinatorId must be numeric');
  }

  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

  try {
    const response = await fetch(`${orchestraUrl}/v0/assistant/${coordinatorId}/wakeup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = (await response.json().catch(() => null)) as OrchestraResponse | null;

    if (!response.ok) {
      const detail = data?.detail || `Failed to wake coordinator: ${response.statusText}`;
      if (response.status === 401) return unauthorized(detail);
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const info = data?.info;
    return NextResponse.json({
      coordinatorId: info?.coordinatorId ?? String(coordinatorId),
      attempted: Boolean(info?.attempted),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to wake coordinator',
      },
      { status: 500 }
    );
  }
}
