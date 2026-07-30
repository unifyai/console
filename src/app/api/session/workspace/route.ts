import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/user/user';
import { PERSONAL_WORKSPACE_ID, writeActiveWorkspaceId } from '@/lib/user/workspace-session';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId } = body;

  if (workspaceId === PERSONAL_WORKSPACE_ID) {
    const user = await getCurrentUser();
    if (user?.personalWorkspaceDisabled) {
      return NextResponse.json(
        { error: 'Personal workspace is disabled for organization members.' },
        { status: 403 }
      );
    }
  }

  const cookieStore = await cookies();

  cookieStore.set('unify_workspace_id', workspaceId, {
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  // The cookie above is Strict, so cross-site entry points never see it. Mirror
  // the selection onto the Lax session token, writing personal as an explicit
  // null so it reads as a choice rather than an unresolved workspace.
  await writeActiveWorkspaceId(workspaceId === PERSONAL_WORKSPACE_ID ? null : workspaceId);

  return NextResponse.json({ success: true });
}
