import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { getCurrentUser } from '@/lib/user/user';

/**
 * GET /api/auth/email/credentials
 *
 * Returns email credential metadata (no sensitive data) for the current user.
 * Used by the Security tab to decide whether to show the "Change Password" form.
 */
export async function GET(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await OrchestraAdminClient.get('/auth/email-credentials', {
      params: { user_id: user.id },
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'lookup_failed', message: 'Credential lookup failed' };
    return NextResponse.json(data, { status });
  }
}

