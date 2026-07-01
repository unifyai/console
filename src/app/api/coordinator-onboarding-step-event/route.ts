/**
 * API route for firing a graph-owned Coordinator onboarding step event.
 *
 * Console owns row clicks; Orchestra owns the event contract attached to
 * those rows. This route keeps the user's API key server-side while asking
 * Orchestra to emit the canonical onboarding event to Unity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getApiKeyFromRequest, unauthorized } from '../_utils/auth';

interface OnboardingStepEventRequest {
  coordinatorId?: unknown;
  stepId?: unknown;
  chipId?: unknown;
}

interface OnboardingStepEventInfo {
  coordinatorId?: string;
  stepId?: string;
  chipId?: string;
  emitted?: boolean;
}

interface OrchestraResponse {
  info?: OnboardingStepEventInfo;
  detail?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  let body: OnboardingStepEventRequest;
  try {
    body = (await request.json()) as OnboardingStepEventRequest;
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

  if (!(typeof body.stepId === 'string' && body.stepId.trim().length > 0)) {
    return badRequest('stepId is required');
  }

  const stepId = body.stepId.trim();
  const chipId =
    typeof body.chipId === 'string' && body.chipId.trim().length > 0
      ? body.chipId.trim()
      : undefined;
  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

  try {
    const response = await fetch(
      `${orchestraUrl}/v0/assistant/${coordinatorId}/onboarding-step-event`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ step_id: stepId, ...(chipId ? { chip_id: chipId } : {}) }),
      }
    );

    const data = (await response.json().catch(() => null)) as OrchestraResponse | null;

    if (!response.ok) {
      const detail =
        data?.detail || `Failed to notify onboarding step event: ${response.statusText}`;
      if (response.status === 401) return unauthorized(detail);
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const info = data?.info;
    return NextResponse.json({
      coordinatorId: info?.coordinatorId ?? String(coordinatorId),
      stepId: info?.stepId ?? stepId,
      chipId: info?.chipId ?? chipId,
      emitted: Boolean(info?.emitted),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to notify onboarding step event',
      },
      { status: 500 }
    );
  }
}
