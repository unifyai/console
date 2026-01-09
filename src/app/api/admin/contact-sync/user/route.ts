import { NextRequest, NextResponse } from 'next/server';
import { internalError, badRequest } from '../../../_utils/auth';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

/**
 * Sync user profile fields (timezone, bio) via assistant lookup.
 *
 * POST /api/admin/contact-sync/user
 * Body: { assistantId: number, targetUserEmail: string, timezone?: string, bio?: string }
 *
 * Proxies to: POST /v0/admin/assistant/update-user
 */
export async function POST(request: NextRequest) {
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[API contact-sync/user] ORCHESTRA_ADMIN_KEY not configured');
    return internalError('Admin key not configured');
  }

  if (!ORCHESTRA_BASE_URL) {
    console.error('[API contact-sync/user] ORCHESTRA_URL not configured');
    return internalError('Backend URL not configured');
  }

  let body: {
    assistantId?: number;
    targetUserEmail?: string;
    timezone?: string;
    bio?: string;
  };

  try {
    body = await request.json();
  } catch (error) {
    return badRequest('Invalid JSON body');
  }

  const { assistantId, targetUserEmail, timezone, bio } = body;

  if (!assistantId || typeof assistantId !== 'number') {
    return badRequest('assistantId (number) is required');
  }

  if (!targetUserEmail || typeof targetUserEmail !== 'string') {
    return badRequest('targetUserEmail (string) is required');
  }

  if (timezone === undefined && bio === undefined) {
    return badRequest('At least one of timezone or bio must be provided');
  }

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/assistant/update-user`;

  const payload: Record<string, any> = {
    assistantId,
    targetUserEmail,
  };
  if (timezone !== undefined) payload.timezone = timezone;
  if (bio !== undefined) payload.bio = bio;

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCasePayload = camelToSnakeObject(payload);

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCasePayload),
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        // Transform snake_case response to camelCase for frontend
        data = snakeToCamelObject(data);
      } else {
        const text = await response.text();
        data = { detail: text || 'Non-JSON response from backend' };
      }
    } catch (parseError) {
      data = { detail: 'Failed to parse backend response' };
    }

    if (!response.ok) {
      console.warn(`[API contact-sync/user] Backend error ${response.status}:`, data);
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API contact-sync/user] Error proxying to backend:', error);
    return internalError('Failed to connect to backend service');
  }
}
