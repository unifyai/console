import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * DELETE /api/user/delete-account
 *
 * Deletes the current user's account.
 * Forwards the x-mfa-code header to the Orchestra backend for MFA verification.
 *
 * If the user has MFA enabled and no valid x-mfa-code is provided,
 * returns 403 { error: "mfa_required" }.
 */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Not authenticated.' },
      { status: 401 }
    );
  }

  try {
    const headers: Record<string, string> = {};
    const mfaCode = request.headers.get('x-mfa-code');
    const mfaRecoveryCode = request.headers.get('x-mfa-recovery-code');
    if (mfaCode) {
      headers['x-mfa-code'] = mfaCode;
    } else if (mfaRecoveryCode) {
      headers['x-mfa-recovery-code'] = mfaRecoveryCode;
    }

    const res = await OrchestraAdminClient.delete('/user', {
      params: { user_id: user.id },
      headers,
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const detail = rawData?.detail ??
      rawData ?? { error: 'delete_failed', message: 'Account deletion failed.' };
    return NextResponse.json(detail, { status });
  }
}
