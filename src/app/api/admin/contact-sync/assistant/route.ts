import { NextRequest, NextResponse } from 'next/server';
import { internalError, badRequest } from '../../../_utils/auth';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

/**
 * Sync assistant profile fields (timezone, about).
 *
 * POST /api/admin/contact-sync/assistant
 * Body: { assistantId: number, timezone?: string, about?: string }
 *
 * Proxies to: PATCH /v0/admin/assistant/{assistant_id}
 */
export async function POST(request: NextRequest) {
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[API contact-sync/assistant] ORCHESTRA_ADMIN_KEY not configured');
    return internalError('Admin key not configured');
  }

  if (!ORCHESTRA_BASE_URL) {
    console.error('[API contact-sync/assistant] ORCHESTRA_URL not configured');
    return internalError('Backend URL not configured');
  }

  let body: {
    assistantId?: number;
    timezone?: string;
    about?: string;
  };

  try {
    body = await request.json();
  } catch (error) {
    return badRequest('Invalid JSON body');
  }

  const { assistantId, timezone, about } = body;

  if (!assistantId || typeof assistantId !== 'number') {
    return badRequest('assistantId (number) is required');
  }

  if (timezone === undefined && about === undefined) {
    return badRequest('At least one of timezone or about must be provided');
  }

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/assistant/${assistantId}`;

  const payload: Record<string, any> = {};
  if (timezone !== undefined) payload.timezone = timezone;
  if (about !== undefined) payload.about = about;

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCasePayload = camelToSnakeObject(payload);

  try {
    const response = await fetch(backendUrl, {
      method: 'PATCH',
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
      console.warn(`[API contact-sync/assistant] Backend error ${response.status}:`, data);
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API contact-sync/assistant] Error proxying to backend:', error);
    return internalError('Failed to connect to backend service');
  }
}
