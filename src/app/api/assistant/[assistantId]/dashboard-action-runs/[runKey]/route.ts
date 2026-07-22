import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '@/app/api/_utils/auth';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

type RouteContext = {
  params: Promise<{ assistantId: string; runKey: string }>;
};

/**
 * Poll one dashboard-action run by run_key (authenticated Console only).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  if (!ORCHESTRA_ADMIN_KEY) {
    return internalError('ORCHESTRA_ADMIN_KEY not configured');
  }

  const { assistantId, runKey } = await context.params;
  if (!assistantId || !runKey) {
    return NextResponse.json({ detail: 'assistantId and runKey are required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${ORCHESTRA_BASE_URL}/admin/task-execution/get`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        assistant_id: assistantId,
        run_key: decodeURIComponent(runKey),
        source_task_log_id: 0,
      }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[dashboard-action run GET]', error);
    return internalError('Failed to load dashboard action run');
  }
}
