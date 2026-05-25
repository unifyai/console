/**
 * API route for notifying the Coordinator that the user just
 * resolved the onboarding picker (chose chat or call). The route
 * proxies the call to Orchestra's
 * ``/v0/assistant/{coordinator_id}/onboarding-session-started``
 * endpoint, which fires a ``coordinator_onboarding_event`` to
 * Unity so the Coordinator's first turn is shaped correctly
 * (intro vs. recap based on the existing transcript history).
 *
 * The endpoint is best-effort on the orchestra side — emissions
 * outside onboarding mode silently no-op and return an ``emitted``
 * flag the client can ignore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getApiKeyFromRequest, unauthorized } from '../_utils/auth';

interface OnboardingSessionStartedRequest {
  coordinatorId?: unknown;
  medium?: unknown;
  completedStepIds?: unknown;
}

interface OnboardingSessionStartedInfo {
  coordinatorId?: string;
  emitted?: boolean;
}

interface OrchestraResponse {
  info?: OnboardingSessionStartedInfo;
  detail?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  let body: OnboardingSessionStartedRequest;
  try {
    body = (await request.json()) as OnboardingSessionStartedRequest;
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

  const medium = body.medium;
  if (medium !== 'chat' && medium !== 'call') {
    return badRequest('medium must be "chat" or "call"');
  }

  let completedStepIds: string[] | undefined;
  if (Array.isArray(body.completedStepIds)) {
    const sanitized = body.completedStepIds
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
    if (sanitized.length > 0) {
      completedStepIds = sanitized;
    }
  }

  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

  try {
    const response = await fetch(
      `${orchestraUrl}/v0/assistant/${coordinatorId}/onboarding-session-started`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          medium,
          completed_step_ids: completedStepIds,
        }),
      }
    );

    const data = (await response.json().catch(() => null)) as OrchestraResponse | null;

    if (!response.ok) {
      const detail =
        data?.detail || `Failed to notify onboarding session start: ${response.statusText}`;
      if (response.status === 401) return unauthorized(detail);
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const info = data?.info;
    return NextResponse.json({
      coordinatorId: info?.coordinatorId ?? String(coordinatorId),
      emitted: Boolean(info?.emitted),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to notify onboarding session start',
      },
      { status: 500 }
    );
  }
}
