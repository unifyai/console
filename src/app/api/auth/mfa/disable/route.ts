import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * DELETE /api/auth/mfa/disable
 *
 * Disables MFA for the authenticated user.
 * Requires a valid TOTP code for confirmation.
 */
export async function DELETE(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const client = await getOrchestraUserClient(apiKey);
    const res = await client.delete('/auth/mfa', { data: body });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'disable_failed', message: 'MFA disable failed' };
    return NextResponse.json(data, { status });
  }
}
