import { NextRequest, NextResponse } from 'next/server';
import { internalError, badRequest } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function DELETE(request: NextRequest, { params }: { params: { linkId: string } }) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return internalError('Admin key not configured');
  }

  const { linkId } = params;
  if (!linkId) {
    return badRequest('Link ID is required');
  }

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/credit-grant-link/${linkId}`;

  try {
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 204) {
      // No Content is a success for DELETE
      return new NextResponse(null, { status: 204 });
    }

    // If not 204, try to parse JSON for error details
    const data = await response
      .json()
      .catch(() => ({ detail: `Orchestra API Error: ${response.statusText}` }));
    return NextResponse.json(snakeToCamelObject(data), { status: response.status });
  } catch (error) {
    console.error(
      `[API Admin Credit Grant Link DELETE ${linkId}] Error proxying to Orchestra:`,
      error
    );
    return internalError('Failed to connect to backend service');
  }
}

