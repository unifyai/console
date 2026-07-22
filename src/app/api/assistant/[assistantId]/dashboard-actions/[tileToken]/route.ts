import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '@/app/api/_utils/auth';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

type RouteContext = {
  params: Promise<{ assistantId: string; tileToken: string }>;
};

/**
 * List dashboard actions registered for one tile (authenticated Console only).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  if (!ORCHESTRA_ADMIN_KEY) {
    return internalError('ORCHESTRA_ADMIN_KEY not configured');
  }

  const { tileToken } = await context.params;
  if (!tileToken) {
    return NextResponse.json({ detail: 'tileToken is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_BASE_URL}/admin/dashboards/actions/${encodeURIComponent(tileToken)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[dashboard-actions GET]', error);
    return internalError('Failed to list dashboard actions');
  }
}
