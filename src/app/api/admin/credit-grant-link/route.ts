import { NextRequest, NextResponse } from 'next/server';
import { internalError, badRequest } from '../../_utils/auth';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function POST(request: NextRequest) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return internalError('Admin key not configured');
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return badRequest('Invalid request body');
  }

  const { expiresInDays = 7, creditAmount = null } = requestBody;

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody: Record<string, unknown> = camelToSnakeObject({ expiresInDays });
  if (creditAmount != null) {
    snakeCaseBody.credit_amount = creditAmount;
  }

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/credit-grant-link`;

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const data = await response.json();

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(data);

    return NextResponse.json(camelCaseResponse, { status: response.status });
  } catch (error) {
    console.error('[API Admin Credit Grant Link POST] Error proxying to Orchestra:', error);
    return internalError('Failed to connect to backend service');
  }
}

export async function GET(request: NextRequest) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return internalError('Admin key not configured');
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/credit-grant-link?limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(data);

    return NextResponse.json(camelCaseResponse, { status: response.status });
  } catch (error) {
    console.error('[API Admin Credit Grant Link GET] Error proxying to Orchestra:', error);
    return internalError('Failed to connect to backend service');
  }
}

