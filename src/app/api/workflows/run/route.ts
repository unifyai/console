/**
 * Run an installed workflow now.
 *
 * A workflow has no runtime of its own — its work is the recurring task it
 * planted — so "run it now" is a trigger on that task, sent with the signed-in
 * owner's own key. Orchestra scopes the task to that key, which is what stops
 * this being a way to start work on somebody else's assistant.
 *
 * Deliberately not a `Workflows/Requests` row: that queue is for install state,
 * which only the assistant's reconcile engine can change. Starting a run needs
 * no reconcile, and routing it through the queue would make an immediate act
 * wait on a wake.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    assistantId?: number | string;
    taskId?: number | string;
  } | null;

  const assistantId = Number(body?.assistantId);
  const taskId = Number(body?.taskId);
  if (!Number.isFinite(assistantId) || !Number.isFinite(taskId)) {
    return NextResponse.json({ detail: 'assistantId and taskId are required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/tasks/${taskId}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assistant_id: assistantId }),
      cache: 'no-store',
    });

    if (response.ok) return NextResponse.json({ started: true }, { status: 200 });

    // 409 is the interesting one: the definition exists but is already running,
    // cancelled or finished. Its detail names which, so pass it through rather
    // than flattening every refusal into "could not start".
    const data = (await response.json().catch(() => null)) as { detail?: string } | null;
    return NextResponse.json(
      { started: false, detail: data?.detail || 'The assistant would not start this job.' },
      { status: response.status }
    );
  } catch {
    return NextResponse.json(
      { started: false, detail: 'Could not reach the assistant runtime.' },
      { status: 502 }
    );
  }
}
