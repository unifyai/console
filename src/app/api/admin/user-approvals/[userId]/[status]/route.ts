import { NextRequest, NextResponse } from 'next/server';
import { internalError, badRequest } from '../../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string; status: string } }
) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return internalError('Admin key not configured');
  }

  const { userId, status } = params;
  if (!userId || !status) {
    return badRequest('User ID and status are required');
  }

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/auth-user/${userId}/assistant-hiring-approval/${status}`;

  try {
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(snakeToCamelObject(data), { status: response.status });
  } catch (error) {
    console.error(
      `[API Admin User Approvals PUT ${userId}/${status}] Error proxying to Orchestra:`,
      error
    );
    return internalError('Failed to connect to backend service');
  }
}
